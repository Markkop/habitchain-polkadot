import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const HabitTrackerModule = buildModule("HabitTrackerModule", (m) => {
  // Treasury address - receives slashed stakes
  // Default to deployer address if not specified
  const treasury = m.getParameter(
    "treasury",
    "0x0000000000000000000000000000000000000000" // REPLACE THIS BEFORE DEPLOYMENT
  );

  const habitTracker = m.contract("HabitTracker", [treasury]);

  return { habitTracker };
});

export default HabitTrackerModule;

