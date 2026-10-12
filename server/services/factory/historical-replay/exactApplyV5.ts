import {
  type ExactReplaySnapshot,
} from "./exactSnapshot";

export interface ExactReplayCommitContext {
  before: ExactReplaySnapshot;
  after: ExactReplaySnapshot;
}

