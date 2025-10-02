// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title HabitTracker
 * @notice Gamified habit tracking with financial commitment
 * @dev Uses epoch-based time (86400-second days) for daily cycles
 * @author HabitChain Team
 */
contract HabitTracker {
    // ============ Constants ============
    
    uint256 public constant STAKE_PER_DAY = 10 ether; // 10 PAS per habit per day
    uint256 private constant SECONDS_PER_DAY = 86400;
    uint32 private constant MAX_SETTLE_BATCH = 50; // Prevent gas exhaustion
    
    // ============ State Variables ============
    
    address public immutable treasury; // Receives slashed stakes
    uint256 public totalTreasuryReceived;
    
    // ============ Structs ============
    
    struct UserState {
        uint256 depositBalance;    // Available funds for staking
        uint256 blockedBalance;    // Funds locked for today
        uint256 claimableBalance;  // Won funds (withdrawable)
        uint32 activeHabitCount;   // Non-archived habits
    }
    
    struct Habit {
        uint32 id;              // User-scoped ID
        address owner;
        string text;            // Description (max 100 chars)
        uint64 createdAtEpoch;  // Day of creation
        bool archived;
    }
    
    struct DailyStatus {
        bool funded;    // Had sufficient balance at day start
        bool checked;   // User checked in during the day
        bool settled;   // Day has been settled
    }
    
    // ============ Storage Mappings ============
    
    mapping(address => UserState) public userStates;
    mapping(address => mapping(uint32 => Habit)) public habits;
    mapping(address => uint32) public userHabitCounters; // Next available ID
    mapping(address => mapping(uint64 => mapping(uint32 => DailyStatus))) public dailyStatuses;
    
    // ============ Events ============
    
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);
    event RedepositedFromClaimable(address indexed user, uint256 amount);
    
    event HabitCreated(address indexed user, uint32 indexed habitId, string text);
    event HabitArchived(address indexed user, uint32 indexed habitId);
    
    event DayPrepared(address indexed user, uint64 indexed epoch, uint32 fundedCount, uint32 insufficientCount);
    event CheckedIn(address indexed user, uint32 indexed habitId, uint64 indexed epoch);
    
    event SettledSuccess(address indexed user, uint32 indexed habitId, uint64 indexed epoch, uint256 reward);
    event SettledFail(address indexed user, uint32 indexed habitId, uint64 indexed epoch, uint256 slashed);
    
    // ============ Errors ============
    
    error InvalidTreasury();
    error InvalidAmount();
    error InsufficientBalance();
    error HabitNotFound();
    error NotHabitOwner();
    error HabitAlreadyArchived();
    error InvalidEpoch();
    error DayNotFunded();
    error AlreadyCheckedIn();
    error AlreadySettled();
    error CannotSettleCurrentDay();
    error InvalidBatchSize();
    error TransferFailed();
    error HabitTextTooLong();
    error HabitTextTooShort();
    
    // ============ Modifiers ============
    
    modifier onlyHabitOwner(uint32 habitId) {
        if (habits[msg.sender][habitId].owner != msg.sender) revert NotHabitOwner();
        _;
    }
    
    modifier validAmount(uint256 amount) {
        if (amount == 0) revert InvalidAmount();
        _;
    }
    
    // ============ Constructor ============
    
    constructor(address _treasury) {
        if (_treasury == address(0)) revert InvalidTreasury();
        treasury = _treasury;
    }
    
    // ============ View Functions ============
    
    /**
     * @notice Get current epoch (civil day since Unix epoch)
     * @return Current epoch as uint64
     */
    function epochNow() public view returns (uint64) {
        return uint64(block.timestamp / SECONDS_PER_DAY);
    }
    
    /**
     * @notice Get user's balance state
     * @param user Address of the user
     * @return UserState struct with all balance information
     */
    function getUserState(address user) external view returns (UserState memory) {
        return userStates[user];
    }
    
    /**
     * @notice Get specific habit details
     * @param user Address of habit owner
     * @param habitId ID of the habit
     * @return Habit struct
     */
    function getHabit(address user, uint32 habitId) external view returns (Habit memory) {
        return habits[user][habitId];
    }
    
    /**
     * @notice Get daily status for a specific habit
     * @param user Address of habit owner
     * @param epoch Day epoch
     * @param habitId ID of the habit
     * @return DailyStatus struct
     */
    function getDailyStatus(address user, uint64 epoch, uint32 habitId) external view returns (DailyStatus memory) {
        return dailyStatuses[user][epoch][habitId];
    }
    
    /**
     * @notice Get all habits for a user (including archived)
     * @param user Address of the user
     * @return Array of Habit structs
     */
    function getAllHabits(address user) external view returns (Habit[] memory) {
        uint32 count = userHabitCounters[user];
        Habit[] memory userHabits = new Habit[](count);
        
        uint32 index = 0;
        for (uint32 i = 1; i <= count; i++) {
            Habit storage habit = habits[user][i];
            if (habit.owner != address(0)) {
                userHabits[index] = habit;
                index++;
            }
        }
        
        // Resize array to actual count (exclude empty slots)
        Habit[] memory result = new Habit[](index);
        for (uint32 i = 0; i < index; i++) {
            result[i] = userHabits[i];
        }
        
        return result;
    }
    
    /**
     * @notice Get only active (non-archived) habits for a user
     * @param user Address of the user
     * @return Array of active Habit structs
     */
    function getActiveHabits(address user) external view returns (Habit[] memory) {
        uint32 count = userHabitCounters[user];
        Habit[] memory activeHabits = new Habit[](userStates[user].activeHabitCount);
        
        uint32 index = 0;
        for (uint32 i = 1; i <= count; i++) {
            Habit storage habit = habits[user][i];
            if (habit.owner != address(0) && !habit.archived) {
                activeHabits[index] = habit;
                index++;
            }
        }
        
        return activeHabits;
    }
    
    // ============ Balance Management Functions ============
    
    /**
     * @notice Deposit PAS tokens into the contract for staking
     */
    function deposit() external payable validAmount(msg.value) {
        userStates[msg.sender].depositBalance += msg.value;
        emit Deposited(msg.sender, msg.value);
    }
    
    /**
     * @notice Withdraw available deposit balance
     * @param amount Amount to withdraw in wei
     */
    function withdraw(uint256 amount) external validAmount(amount) {
        UserState storage state = userStates[msg.sender];
        
        if (state.depositBalance < amount) revert InsufficientBalance();
        
        state.depositBalance -= amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit Withdrawn(msg.sender, amount);
    }
    
    /**
     * @notice Claim won rewards from claimable balance
     * @param amount Amount to claim in wei
     */
    function claim(uint256 amount) external validAmount(amount) {
        UserState storage state = userStates[msg.sender];
        
        if (state.claimableBalance < amount) revert InsufficientBalance();
        
        state.claimableBalance -= amount;
        
        (bool success, ) = msg.sender.call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit Claimed(msg.sender, amount);
    }
    
    /**
     * @notice Move funds from claimable to deposit balance without external transfer
     * @param amount Amount to redeposit in wei
     */
    function redepositFromClaimable(uint256 amount) external validAmount(amount) {
        UserState storage state = userStates[msg.sender];
        
        if (state.claimableBalance < amount) revert InsufficientBalance();
        
        state.claimableBalance -= amount;
        state.depositBalance += amount;
        
        emit RedepositedFromClaimable(msg.sender, amount);
    }
    
    // ============ Habit Management Functions ============
    
    /**
     * @notice Create a new habit
     * @param text Description of the habit (3-100 characters)
     * @return habitId The ID of the newly created habit
     */
    function createHabit(string calldata text) external returns (uint32) {
        if (bytes(text).length < 3) revert HabitTextTooShort();
        if (bytes(text).length > 100) revert HabitTextTooLong();
        
        uint32 habitId = ++userHabitCounters[msg.sender];
        
        habits[msg.sender][habitId] = Habit({
            id: habitId,
            owner: msg.sender,
            text: text,
            createdAtEpoch: epochNow(),
            archived: false
        });
        
        userStates[msg.sender].activeHabitCount++;
        
        emit HabitCreated(msg.sender, habitId, text);
        
        return habitId;
    }
    
    /**
     * @notice Archive a habit (soft delete)
     * @param habitId ID of the habit to archive
     */
    function archiveHabit(uint32 habitId) external onlyHabitOwner(habitId) {
        Habit storage habit = habits[msg.sender][habitId];
        
        if (habit.archived) revert HabitAlreadyArchived();
        
        habit.archived = true;
        userStates[msg.sender].activeHabitCount--;
        
        emit HabitArchived(msg.sender, habitId);
    }
    
    // ============ Daily Cycle Functions ============
    
    /**
     * @notice Prepare the day by locking funds for active habits
     * @param epoch The epoch to prepare (must be current day)
     */
    function prepareDay(uint64 epoch) external {
        if (epoch != epochNow()) revert InvalidEpoch();
        
        UserState storage state = userStates[msg.sender];
        uint32 count = userHabitCounters[msg.sender];
        
        uint32 fundedCount = 0;
        uint32 insufficientCount = 0;
        
        for (uint32 i = 1; i <= count; i++) {
            Habit storage habit = habits[msg.sender][i];
            
            // Skip archived or non-existent habits
            if (habit.archived || habit.owner == address(0)) continue;
            
            DailyStatus storage status = dailyStatuses[msg.sender][epoch][i];
            
            // Skip already prepared habits
            if (status.funded) continue;
            
            // Check if sufficient balance
            if (state.depositBalance >= STAKE_PER_DAY) {
                state.depositBalance -= STAKE_PER_DAY;
                state.blockedBalance += STAKE_PER_DAY;
                status.funded = true;
                fundedCount++;
            } else {
                insufficientCount++;
            }
        }
        
        emit DayPrepared(msg.sender, epoch, fundedCount, insufficientCount);
    }
    
    /**
     * @notice Check in to a habit for the current day
     * @param habitId ID of the habit
     * @param epoch The epoch to check in (must be current day)
     */
    function checkIn(uint32 habitId, uint64 epoch) external onlyHabitOwner(habitId) {
        if (epoch != epochNow()) revert InvalidEpoch();
        
        Habit storage habit = habits[msg.sender][habitId];
        if (habit.archived) revert HabitNotFound();
        
        DailyStatus storage status = dailyStatuses[msg.sender][epoch][habitId];
        
        if (!status.funded) revert DayNotFunded();
        if (status.checked) revert AlreadyCheckedIn();
        
        status.checked = true;
        
        emit CheckedIn(msg.sender, habitId, epoch);
    }
    
    /**
     * @notice Settle a specific habit for a past day
     * @param user Address of habit owner
     * @param epoch The epoch to settle (must be past day)
     * @param habitId ID of the habit to settle
     */
    function settle(address user, uint64 epoch, uint32 habitId) public {
        if (epoch >= epochNow()) revert CannotSettleCurrentDay();
        
        Habit storage habit = habits[user][habitId];
        if (habit.owner == address(0)) revert HabitNotFound();
        
        DailyStatus storage status = dailyStatuses[user][epoch][habitId];
        
        if (!status.funded) revert DayNotFunded();
        if (status.settled) revert AlreadySettled();
        
        UserState storage state = userStates[user];
        
        status.settled = true;
        
        if (status.checked) {
            // SUCCESS: Move from blocked -> claimable
            state.blockedBalance -= STAKE_PER_DAY;
            state.claimableBalance += STAKE_PER_DAY;
            emit SettledSuccess(user, habitId, epoch, STAKE_PER_DAY);
        } else {
            // FAILURE: Transfer to treasury
            state.blockedBalance -= STAKE_PER_DAY;
            totalTreasuryReceived += STAKE_PER_DAY;
            
            (bool success, ) = treasury.call{value: STAKE_PER_DAY}("");
            if (!success) revert TransferFailed();
            
            emit SettledFail(user, habitId, epoch, STAKE_PER_DAY);
        }
    }
    
    /**
     * @notice Settle all funded habits for a user for a specific past day
     * @param user Address of habit owner
     * @param epoch The epoch to settle (must be past day)
     * @param maxCount Maximum number of habits to settle (gas limit protection)
     */
    function settleAll(address user, uint64 epoch, uint32 maxCount) external {
        if (epoch >= epochNow()) revert CannotSettleCurrentDay();
        if (maxCount == 0 || maxCount > MAX_SETTLE_BATCH) revert InvalidBatchSize();
        
        uint32 count = userHabitCounters[user];
        uint32 settled = 0;
        
        for (uint32 i = 1; i <= count && settled < maxCount; i++) {
            Habit storage habit = habits[user][i];
            if (habit.owner == address(0) || habit.archived) continue;
            
            DailyStatus storage status = dailyStatuses[user][epoch][i];
            if (status.funded && !status.settled) {
                settle(user, epoch, i);
                settled++;
            }
        }
    }
    
    // ============ Emergency Functions ============
    
    /**
     * @notice Get contract's total PAS balance
     * @return Balance in wei
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @notice Calculate total user funds in contract (for verification)
     * @param user Address to check
     * @return Total of deposit + blocked + claimable
     */
    function getTotalUserFunds(address user) external view returns (uint256) {
        UserState storage state = userStates[user];
        return state.depositBalance + state.blockedBalance + state.claimableBalance;
    }
}

