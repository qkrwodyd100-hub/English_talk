export const SESSION_CONTRACT_VERSION = 'v1' as const;

export type SessionSpeaker = 'learner' | 'coach';
export type TranscriptImportSource = 'manual-paste' | 'local-file';

export interface ConversationTurn {
  speaker: SessionSpeaker;
  text: string;
  occurredAt: string; // ISO-8601 UTC date-time
}

export interface CreateSessionRequest {
  scenarioId: string;
  title: string;
  turns: ConversationTurn[];
}

export interface Session extends CreateSessionRequest {
  contractVersion: typeof SESSION_CONTRACT_VERSION;
  id: string;
  storage: 'local' | 'remote';
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptImportRequest {
  source: TranscriptImportSource;
  scenarioId?: string;
  title?: string;
  turns: ConversationTurn[];
}

export interface FeedbackResponse {
  contractVersion: typeof SESSION_CONTRACT_VERSION;
  sessionId: string;
  generator: 'local-rule' | 'provider';
  providerCallMade: boolean;
  summary: string;
  suggestions: string[];
}

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'SESSION_NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'CONFLICT';

export interface ApiErrorResponse {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Array<{ field?: string; reason: string }>;
  };
}
