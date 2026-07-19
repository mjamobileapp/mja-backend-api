const MACHINE_STATUSES = Object.freeze({
  READY: "READY",
  IN_USE: "IN_USE",
  OFFLINE: "OFFLINE",
});

const normalizeMachineStatus = (value) =>
  String(value || "").trim().toUpperCase();

const isMachineStatus = (value) =>
  Object.values(MACHINE_STATUSES).includes(normalizeMachineStatus(value));

module.exports = {
  MACHINE_STATUSES,
  isMachineStatus,
  normalizeMachineStatus,
};
