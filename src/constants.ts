export const PROTOCOL_VERSION = 1;

export const VALIDATOR_CONTRACT_PARAMS = {
  valPerBlockTarget: 5,
  nodeRandomMinCount: 1,
  nodeRandomPingCount: 1,
  REPORTS_BEFORE_SLASH_V: 2, // 10 for prod
  REPORTS_BEFORE_SLASH_S: 2, // 50 for prod
  SLASHES_BEFORE_BAN_V: 2,
  SLASHES_BEFORE_BAN_S: 2,
  SLASH_PERCENT: 10,
  BAN_PERCENT: 10
};

export const STORAGE_CONTRACT_PARAMS = {
  rfTarget: 5
};
