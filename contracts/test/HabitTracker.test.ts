import { expect } from "chai";
import { ethers } from "hardhat";
import { HabitTracker } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("HabitTracker", function () {
  let habitTracker: HabitTracker;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let treasury: HardhatEthersSigner;

  const STAKE_PER_DAY = ethers.parseEther("10");
  const SECONDS_PER_DAY = 86400;

  beforeEach(async function () {
    [owner, user1, user2, treasury] = await ethers.getSigners();

    const HabitTrackerFactory = await ethers.getContractFactory("HabitTracker");
    habitTracker = await HabitTrackerFactory.deploy(treasury.address);
    await habitTracker.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct treasury address", async function () {
      expect(await habitTracker.treasury()).to.equal(treasury.address);
    });

    it("Should initialize with zero balances", async function () {
      const userState = await habitTracker.getUserState(user1.address);
      expect(userState.depositBalance).to.equal(0);
      expect(userState.blockedBalance).to.equal(0);
      expect(userState.claimableBalance).to.equal(0);
      expect(userState.activeHabitCount).to.equal(0);
    });

    it("Should revert if treasury is zero address", async function () {
      const HabitTrackerFactory = await ethers.getContractFactory("HabitTracker");
      await expect(
        HabitTrackerFactory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(habitTracker, "InvalidTreasury");
    });
  });

  describe("Balance Management", function () {
    describe("Deposits", function () {
      it("Should deposit PAS correctly", async function () {
        const depositAmount = ethers.parseEther("100");
        
        await expect(
          habitTracker.connect(user1).deposit({ value: depositAmount })
        )
          .to.emit(habitTracker, "Deposited")
          .withArgs(user1.address, depositAmount);

        const userState = await habitTracker.getUserState(user1.address);
        expect(userState.depositBalance).to.equal(depositAmount);
      });

      it("Should revert on zero deposit", async function () {
        await expect(
          habitTracker.connect(user1).deposit({ value: 0 })
        ).to.be.revertedWithCustomError(habitTracker, "InvalidAmount");
      });

      it("Should accumulate multiple deposits", async function () {
        await habitTracker.connect(user1).deposit({ value: ethers.parseEther("50") });
        await habitTracker.connect(user1).deposit({ value: ethers.parseEther("50") });

        const userState = await habitTracker.getUserState(user1.address);
        expect(userState.depositBalance).to.equal(ethers.parseEther("100"));
      });
    });

    describe("Withdrawals", function () {
      beforeEach(async function () {
        await habitTracker.connect(user1).deposit({ value: ethers.parseEther("100") });
      });

      it("Should withdraw available balance", async function () {
        const withdrawAmount = ethers.parseEther("50");
        const balanceBefore = await ethers.provider.getBalance(user1.address);

        const tx = await habitTracker.connect(user1).withdraw(withdrawAmount);
        const receipt = await tx.wait();
        const gasCost = receipt!.gasUsed * tx.gasPrice!;

        const balanceAfter = await ethers.provider.getBalance(user1.address);
        expect(balanceAfter).to.equal(balanceBefore - gasCost + withdrawAmount);

        const userState = await habitTracker.getUserState(user1.address);
        expect(userState.depositBalance).to.equal(ethers.parseEther("50"));
      });

      it("Should revert if insufficient balance", async function () {
        await expect(
          habitTracker.connect(user1).withdraw(ethers.parseEther("150"))
        ).to.be.revertedWithCustomError(habitTracker, "InsufficientBalance");
      });

      it("Should not allow withdrawing blocked funds", async function () {
        // Create habit and prepare day to block funds
        await habitTracker.connect(user1).createHabit("Test Habit");
        const epoch = await habitTracker.epochNow();
        await habitTracker.connect(user1).prepareDay(epoch);

        const userState = await habitTracker.getUserState(user1.address);
        const availableBalance = userState.depositBalance;

        // Try to withdraw more than available (including blocked)
        await expect(
          habitTracker.connect(user1).withdraw(availableBalance + 1n)
        ).to.be.revertedWithCustomError(habitTracker, "InsufficientBalance");
      });
    });

    describe("Claims", function () {
      it("Should claim rewards after settlement", async function () {
        // Setup: deposit, create habit, prepare day, check in, advance time, settle
        await habitTracker.connect(user1).deposit({ value: ethers.parseEther("20") });
        await habitTracker.connect(user1).createHabit("Test Habit");
        
        const epoch = await habitTracker.epochNow();
        await habitTracker.connect(user1).prepareDay(epoch);
        await habitTracker.connect(user1).checkIn(1, epoch);
        
        // Advance to next day
        await time.increase(SECONDS_PER_DAY);
        
        // Settle
        const newEpoch = await habitTracker.epochNow();
        await habitTracker.connect(user1).settleAll(user1.address, newEpoch - 1n, 50);

        const userStateBefore = await habitTracker.getUserState(user1.address);
        expect(userStateBefore.claimableBalance).to.equal(STAKE_PER_DAY);

        // Claim
        const balanceBefore = await ethers.provider.getBalance(user1.address);
        const tx = await habitTracker.connect(user1).claim(STAKE_PER_DAY);
        const receipt = await tx.wait();
        const gasCost = receipt!.gasUsed * tx.gasPrice!;

        const balanceAfter = await ethers.provider.getBalance(user1.address);
        expect(balanceAfter).to.equal(balanceBefore - gasCost + STAKE_PER_DAY);

        const userStateAfter = await habitTracker.getUserState(user1.address);
        expect(userStateAfter.claimableBalance).to.equal(0);
      });

      it("Should revert if insufficient claimable balance", async function () {
        await expect(
          habitTracker.connect(user1).claim(ethers.parseEther("10"))
        ).to.be.revertedWithCustomError(habitTracker, "InsufficientBalance");
      });
    });

    describe("Redeposit from Claimable", function () {
      it("Should move funds from claimable to deposit", async function () {
        // Setup to have claimable balance
        await habitTracker.connect(user1).deposit({ value: ethers.parseEther("20") });
        await habitTracker.connect(user1).createHabit("Test Habit");
        
        const epoch = await habitTracker.epochNow();
        await habitTracker.connect(user1).prepareDay(epoch);
        await habitTracker.connect(user1).checkIn(1, epoch);
        
        await time.increase(SECONDS_PER_DAY);
        
        const newEpoch = await habitTracker.epochNow();
        await habitTracker.connect(user1).settleAll(user1.address, newEpoch - 1n, 50);

        // Redeposit
        await expect(
          habitTracker.connect(user1).redepositFromClaimable(STAKE_PER_DAY)
        )
          .to.emit(habitTracker, "RedepositedFromClaimable")
          .withArgs(user1.address, STAKE_PER_DAY);

        const userState = await habitTracker.getUserState(user1.address);
        expect(userState.claimableBalance).to.equal(0);
        expect(userState.depositBalance).to.equal(ethers.parseEther("10"));
      });
    });
  });

  describe("Habit Management", function () {
    describe("Create Habit", function () {
      it("Should create habit with auto-incrementing ID", async function () {
        await expect(
          habitTracker.connect(user1).createHabit("Exercise 30 minutes")
        )
          .to.emit(habitTracker, "HabitCreated")
          .withArgs(user1.address, 1, "Exercise 30 minutes");

        const habit = await habitTracker.getHabit(user1.address, 1);
        expect(habit.id).to.equal(1);
        expect(habit.owner).to.equal(user1.address);
        expect(habit.text).to.equal("Exercise 30 minutes");
        expect(habit.archived).to.be.false;

        const userState = await habitTracker.getUserState(user1.address);
        expect(userState.activeHabitCount).to.equal(1);
      });

      it("Should create multiple habits with sequential IDs", async function () {
        await habitTracker.connect(user1).createHabit("Habit 1");
        await habitTracker.connect(user1).createHabit("Habit 2");
        await habitTracker.connect(user1).createHabit("Habit 3");

        const userState = await habitTracker.getUserState(user1.address);
        expect(userState.activeHabitCount).to.equal(3);

        const habit3 = await habitTracker.getHabit(user1.address, 3);
        expect(habit3.text).to.equal("Habit 3");
      });

      it("Should revert if text is too short", async function () {
        await expect(
          habitTracker.connect(user1).createHabit("ab")
        ).to.be.revertedWithCustomError(habitTracker, "HabitTextTooShort");
      });

      it("Should revert if text is too long", async function () {
        const longText = "a".repeat(101);
        await expect(
          habitTracker.connect(user1).createHabit(longText)
        ).to.be.revertedWithCustomError(habitTracker, "HabitTextTooLong");
      });

      it("Should allow exactly 100 characters", async function () {
        const text = "a".repeat(100);
        await habitTracker.connect(user1).createHabit(text);
        const habit = await habitTracker.getHabit(user1.address, 1);
        expect(habit.text).to.equal(text);
      });
    });

    describe("Archive Habit", function () {
      beforeEach(async function () {
        await habitTracker.connect(user1).createHabit("Test Habit");
      });

      it("Should archive habit and decrement counter", async function () {
        await expect(
          habitTracker.connect(user1).archiveHabit(1)
        )
          .to.emit(habitTracker, "HabitArchived")
          .withArgs(user1.address, 1);

        const habit = await habitTracker.getHabit(user1.address, 1);
        expect(habit.archived).to.be.true;

        const userState = await habitTracker.getUserState(user1.address);
        expect(userState.activeHabitCount).to.equal(0);
      });

      it("Should prevent archiving non-owned habits", async function () {
        await expect(
          habitTracker.connect(user2).archiveHabit(1)
        ).to.be.revertedWithCustomError(habitTracker, "NotHabitOwner");
      });

      it("Should revert if habit already archived", async function () {
        await habitTracker.connect(user1).archiveHabit(1);
        await expect(
          habitTracker.connect(user1).archiveHabit(1)
        ).to.be.revertedWithCustomError(habitTracker, "HabitAlreadyArchived");
      });
    });

    describe("Get All Habits", function () {
      it("Should retrieve all user habits", async function () {
        await habitTracker.connect(user1).createHabit("Habit 1");
        await habitTracker.connect(user1).createHabit("Habit 2");
        await habitTracker.connect(user1).createHabit("Habit 3");

        const habits = await habitTracker.getAllHabits(user1.address);
        expect(habits.length).to.equal(3);
        expect(habits[0].text).to.equal("Habit 1");
        expect(habits[2].text).to.equal("Habit 3");
      });

      it("Should include archived habits", async function () {
        await habitTracker.connect(user1).createHabit("Habit 1");
        await habitTracker.connect(user1).createHabit("Habit 2");
        await habitTracker.connect(user1).archiveHabit(1);

        const habits = await habitTracker.getAllHabits(user1.address);
        expect(habits.length).to.equal(2);
        expect(habits[0].archived).to.be.true;
      });
    });

    describe("Get Active Habits", function () {
      it("Should retrieve only active habits", async function () {
        await habitTracker.connect(user1).createHabit("Habit 1");
        await habitTracker.connect(user1).createHabit("Habit 2");
        await habitTracker.connect(user1).createHabit("Habit 3");
        await habitTracker.connect(user1).archiveHabit(2);

        const habits = await habitTracker.getActiveHabits(user1.address);
        expect(habits.length).to.equal(2);
        expect(habits[0].text).to.equal("Habit 1");
        expect(habits[1].text).to.equal("Habit 3");
      });
    });
  });

  describe("Daily Cycle", function () {
    beforeEach(async function () {
      await habitTracker.connect(user1).deposit({ value: ethers.parseEther("100") });
      await habitTracker.connect(user1).createHabit("Habit 1");
      await habitTracker.connect(user1).createHabit("Habit 2");
      await habitTracker.connect(user1).createHabit("Habit 3");
    });

    describe("Prepare Day", function () {
      it("Should prepare day and block funds", async function () {
        const epoch = await habitTracker.epochNow();
        
        await expect(
          habitTracker.connect(user1).prepareDay(epoch)
        )
          .to.emit(habitTracker, "DayPrepared")
          .withArgs(user1.address, epoch, 3, 0);

        const userState = await habitTracker.getUserState(user1.address);
        expect(userState.blockedBalance).to.equal(ethers.parseEther("30"));
        expect(userState.depositBalance).to.equal(ethers.parseEther("70"));
      });

      it("Should handle insufficient balance during prepare", async function () {
        // Withdraw most funds, leaving only enough for 1 habit
        await habitTracker.connect(user1).withdraw(ethers.parseEther("85"));

        const epoch = await habitTracker.epochNow();
        await expect(
          habitTracker.connect(user1).prepareDay(epoch)
        )
          .to.emit(habitTracker, "DayPrepared")
          .withArgs(user1.address, epoch, 1, 2);

        const userState = await habitTracker.getUserState(user1.address);
        expect(userState.blockedBalance).to.equal(ethers.parseEther("10"));
      });

      it("Should not prepare archived habits", async function () {
        await habitTracker.connect(user1).archiveHabit(2);

        const epoch = await habitTracker.epochNow();
        await expect(
          habitTracker.connect(user1).prepareDay(epoch)
        )
          .to.emit(habitTracker, "DayPrepared")
          .withArgs(user1.address, epoch, 2, 0);

        const userState = await habitTracker.getUserState(user1.address);
        expect(userState.blockedBalance).to.equal(ethers.parseEther("20"));
      });

      it("Should revert if trying to prepare future day", async function () {
        const epoch = await habitTracker.epochNow();
        await expect(
          habitTracker.connect(user1).prepareDay(epoch + 1n)
        ).to.be.revertedWithCustomError(habitTracker, "InvalidEpoch");
      });

      it("Should allow preparing same day multiple times (idempotent)", async function () {
        const epoch = await habitTracker.epochNow();
        await habitTracker.connect(user1).prepareDay(epoch);
        await habitTracker.connect(user1).prepareDay(epoch);

        const userState = await habitTracker.getUserState(user1.address);
        expect(userState.blockedBalance).to.equal(ethers.parseEther("30"));
      });
    });

    describe("Check In", function () {
      beforeEach(async function () {
        const epoch = await habitTracker.epochNow();
        await habitTracker.connect(user1).prepareDay(epoch);
      });

      it("Should allow check-in during current day", async function () {
        const epoch = await habitTracker.epochNow();
        
        await expect(
          habitTracker.connect(user1).checkIn(1, epoch)
        )
          .to.emit(habitTracker, "CheckedIn")
          .withArgs(user1.address, 1, epoch);

        const status = await habitTracker.getDailyStatus(user1.address, epoch, 1);
        expect(status.checked).to.be.true;
      });

      it("Should revert if checking in for past day", async function () {
        const epoch = await habitTracker.epochNow();
        
        await time.increase(SECONDS_PER_DAY);
        
        await expect(
          habitTracker.connect(user1).checkIn(1, epoch)
        ).to.be.revertedWithCustomError(habitTracker, "InvalidEpoch");
      });

      it("Should revert if day not funded", async function () {
        // Create new habit without preparing
        await habitTracker.connect(user1).createHabit("Unfunded Habit");
        const epoch = await habitTracker.epochNow();
        
        await expect(
          habitTracker.connect(user1).checkIn(4, epoch)
        ).to.be.revertedWithCustomError(habitTracker, "DayNotFunded");
      });

      it("Should revert if already checked in", async function () {
        const epoch = await habitTracker.epochNow();
        await habitTracker.connect(user1).checkIn(1, epoch);
        
        await expect(
          habitTracker.connect(user1).checkIn(1, epoch)
        ).to.be.revertedWithCustomError(habitTracker, "AlreadyCheckedIn");
      });

      it("Should revert if not habit owner", async function () {
        const epoch = await habitTracker.epochNow();
        
        await expect(
          habitTracker.connect(user2).checkIn(1, epoch)
        ).to.be.revertedWithCustomError(habitTracker, "NotHabitOwner");
      });
    });

    describe("Settlement", function () {
      beforeEach(async function () {
        const epoch = await habitTracker.epochNow();
        await habitTracker.connect(user1).prepareDay(epoch);
      });

      it("Should settle successful day (checked in)", async function () {
        const epoch = await habitTracker.epochNow();
        await habitTracker.connect(user1).checkIn(1, epoch);
        
        await time.increase(SECONDS_PER_DAY);
        
        const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);
        
        await expect(
          habitTracker.settle(user1.address, epoch, 1)
        )
          .to.emit(habitTracker, "SettledSuccess")
          .withArgs(user1.address, 1, epoch, STAKE_PER_DAY);

        const userState = await habitTracker.getUserState(user1.address);
        expect(userState.claimableBalance).to.equal(STAKE_PER_DAY);
        expect(userState.blockedBalance).to.equal(ethers.parseEther("20"));

        const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);
        expect(treasuryBalanceAfter).to.equal(treasuryBalanceBefore);
      });

      it("Should settle failed day (not checked in)", async function () {
        const epoch = await habitTracker.epochNow();
        // Don't check in
        
        await time.increase(SECONDS_PER_DAY);
        
        const treasuryBalanceBefore = await ethers.provider.getBalance(treasury.address);
        
        await expect(
          habitTracker.settle(user1.address, epoch, 1)
        )
          .to.emit(habitTracker, "SettledFail")
          .withArgs(user1.address, 1, epoch, STAKE_PER_DAY);

        const userState = await habitTracker.getUserState(user1.address);
        expect(userState.claimableBalance).to.equal(0);
        expect(userState.blockedBalance).to.equal(ethers.parseEther("20"));

        const treasuryBalanceAfter = await ethers.provider.getBalance(treasury.address);
        expect(treasuryBalanceAfter).to.equal(treasuryBalanceBefore + STAKE_PER_DAY);
      });

      it("Should revert if trying to settle current day", async function () {
        const epoch = await habitTracker.epochNow();
        
        await expect(
          habitTracker.settle(user1.address, epoch, 1)
        ).to.be.revertedWithCustomError(habitTracker, "CannotSettleCurrentDay");
      });

      it("Should revert if day not funded", async function () {
        await habitTracker.connect(user1).createHabit("Unfunded Habit");
        const epoch = await habitTracker.epochNow();
        
        await time.increase(SECONDS_PER_DAY);
        
        await expect(
          habitTracker.settle(user1.address, epoch, 4)
        ).to.be.revertedWithCustomError(habitTracker, "DayNotFunded");
      });

      it("Should revert if already settled", async function () {
        const epoch = await habitTracker.epochNow();
        await habitTracker.connect(user1).checkIn(1, epoch);
        
        await time.increase(SECONDS_PER_DAY);
        
        await habitTracker.settle(user1.address, epoch, 1);
        
        await expect(
          habitTracker.settle(user1.address, epoch, 1)
        ).to.be.revertedWithCustomError(habitTracker, "AlreadySettled");
      });
    });

    describe("Batch Settlement", function () {
      it("Should batch settle multiple habits", async function () {
        const epoch = await habitTracker.epochNow();
        await habitTracker.connect(user1).checkIn(1, epoch);
        await habitTracker.connect(user1).checkIn(2, epoch);
        // Don't check in habit 3
        
        await time.increase(SECONDS_PER_DAY);
        
        const newEpoch = await habitTracker.epochNow();
        await habitTracker.settleAll(user1.address, newEpoch - 1n, 50);

        const userState = await habitTracker.getUserState(user1.address);
        expect(userState.claimableBalance).to.equal(ethers.parseEther("20"));
        expect(userState.blockedBalance).to.equal(0);
      });

      it("Should respect maxCount limit", async function () {
        const epoch = await habitTracker.epochNow();
        
        await time.increase(SECONDS_PER_DAY);
        
        const newEpoch = await habitTracker.epochNow();
        await habitTracker.settleAll(user1.address, newEpoch - 1n, 2);

        // Only 2 habits should be settled
        const status1 = await habitTracker.getDailyStatus(user1.address, epoch, 1);
        const status2 = await habitTracker.getDailyStatus(user1.address, epoch, 2);
        const status3 = await habitTracker.getDailyStatus(user1.address, epoch, 3);
        
        expect(status1.settled).to.be.true;
        expect(status2.settled).to.be.true;
        expect(status3.settled).to.be.false;
      });

      it("Should revert if maxCount is zero", async function () {
        const epoch = await habitTracker.epochNow();
        await time.increase(SECONDS_PER_DAY);
        
        const newEpoch = await habitTracker.epochNow();
        await expect(
          habitTracker.settleAll(user1.address, newEpoch - 1n, 0)
        ).to.be.revertedWithCustomError(habitTracker, "InvalidBatchSize");
      });

      it("Should revert if maxCount exceeds MAX_SETTLE_BATCH", async function () {
        const epoch = await habitTracker.epochNow();
        await time.increase(SECONDS_PER_DAY);
        
        const newEpoch = await habitTracker.epochNow();
        await expect(
          habitTracker.settleAll(user1.address, newEpoch - 1n, 51)
        ).to.be.revertedWithCustomError(habitTracker, "InvalidBatchSize");
      });

      it("Should allow anyone to settle any user's day", async function () {
        const epoch = await habitTracker.epochNow();
        await habitTracker.connect(user1).checkIn(1, epoch);
        
        await time.increase(SECONDS_PER_DAY);
        
        const newEpoch = await habitTracker.epochNow();
        // user2 settling user1's day
        await habitTracker.connect(user2).settleAll(user1.address, newEpoch - 1n, 50);

        const userState = await habitTracker.getUserState(user1.address);
        expect(userState.claimableBalance).to.equal(STAKE_PER_DAY);
      });
    });
  });

  describe("Edge Cases", function () {
    it("Should handle epoch boundary correctly", async function () {
      await habitTracker.connect(user1).deposit({ value: ethers.parseEther("20") });
      await habitTracker.connect(user1).createHabit("Test Habit");
      
      const epoch1 = await habitTracker.epochNow();
      await habitTracker.connect(user1).prepareDay(epoch1);
      await habitTracker.connect(user1).checkIn(1, epoch1);
      
      // Advance exactly to next day boundary
      const currentTime = await time.latest();
      const nextDayStart = Math.floor(currentTime / SECONDS_PER_DAY) * SECONDS_PER_DAY + SECONDS_PER_DAY;
      await time.increaseTo(nextDayStart);
      
      const epoch2 = await habitTracker.epochNow();
      expect(epoch2).to.equal(epoch1 + 1n);
      
      // Should be able to settle previous day
      await habitTracker.settle(user1.address, epoch1, 1);
      
      // Should be able to prepare new day
      await habitTracker.connect(user1).prepareDay(epoch2);
    });

    it("Should handle archived habits in settle", async function () {
      await habitTracker.connect(user1).deposit({ value: ethers.parseEther("20") });
      await habitTracker.connect(user1).createHabit("Test Habit");
      
      const epoch = await habitTracker.epochNow();
      await habitTracker.connect(user1).prepareDay(epoch);
      await habitTracker.connect(user1).archiveHabit(1);
      
      await time.increase(SECONDS_PER_DAY);
      
      const newEpoch = await habitTracker.epochNow();
      // Should not throw, archived habits are skipped
      await habitTracker.settleAll(user1.address, newEpoch - 1n, 50);
    });

    it("Should maintain correct balance invariants", async function () {
      await habitTracker.connect(user1).deposit({ value: ethers.parseEther("50") });
      await habitTracker.connect(user1).createHabit("Habit 1");
      
      const epoch = await habitTracker.epochNow();
      await habitTracker.connect(user1).prepareDay(epoch);
      await habitTracker.connect(user1).checkIn(1, epoch);
      
      await time.increase(SECONDS_PER_DAY);
      
      const newEpoch = await habitTracker.epochNow();
      await habitTracker.settleAll(user1.address, newEpoch - 1n, 50);
      
      const userState = await habitTracker.getUserState(user1.address);
      const totalUserFunds = await habitTracker.getTotalUserFunds(user1.address);
      
      expect(totalUserFunds).to.equal(
        userState.depositBalance + userState.blockedBalance + userState.claimableBalance
      );
    });
  });

  describe("View Functions", function () {
    it("Should return correct contract balance", async function () {
      await habitTracker.connect(user1).deposit({ value: ethers.parseEther("100") });
      await habitTracker.connect(user2).deposit({ value: ethers.parseEther("50") });
      
      const contractBalance = await habitTracker.getContractBalance();
      expect(contractBalance).to.equal(ethers.parseEther("150"));
    });

    it("Should calculate total user funds correctly", async function () {
      await habitTracker.connect(user1).deposit({ value: ethers.parseEther("100") });
      await habitTracker.connect(user1).createHabit("Test");
      
      const epoch = await habitTracker.epochNow();
      await habitTracker.connect(user1).prepareDay(epoch);
      await habitTracker.connect(user1).checkIn(1, epoch);
      
      await time.increase(SECONDS_PER_DAY);
      
      const newEpoch = await habitTracker.epochNow();
      await habitTracker.settleAll(user1.address, newEpoch - 1n, 50);
      
      const totalFunds = await habitTracker.getTotalUserFunds(user1.address);
      expect(totalFunds).to.equal(ethers.parseEther("100"));
    });
  });
});

