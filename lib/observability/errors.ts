/**
 * Typed failures.
 *
 * Every external call fails eventually; the question is only whether the user
 * sees "Something went wrong" or something they can act on. `userMessage` is the
 * only string that may ever reach the UI — raw provider errors never do.
 */
export type FailureKind =
  | 'rate_limited'
  | 'quota_exceeded'
  | 'not_found'
  | 'no_results'
  | 'invalid_request'
  | 'upstream_unavailable'
  | 'timeout'
  | 'auth'
  | 'unknown';

export class ServiceError extends Error {
  override name = 'ServiceError';
  readonly kind: FailureKind;
  readonly provider: string;
  readonly retryable: boolean;
  readonly userMessage: string;
  readonly status: number | undefined;

  constructor(args: {
    kind: FailureKind;
    provider: string;
    message: string;
    userMessage?: string;
    status?: number;
    cause?: unknown;
  }) {
    super(args.message, args.cause !== undefined ? { cause: args.cause } : undefined);
    this.kind = args.kind;
    this.provider = args.provider;
    this.status = args.status;
    this.retryable = args.kind === 'rate_limited' || args.kind === 'upstream_unavailable' || args.kind === 'timeout';
    this.userMessage = args.userMessage ?? DEFAULT_USER_MESSAGE[args.kind];
  }
}

const DEFAULT_USER_MESSAGE: Record<FailureKind, string> = {
  rate_limited: 'We are being rate limited right now. Give it a moment and try again.',
  quota_exceeded: 'We have hit our daily capacity. Please try again tomorrow.',
  not_found: 'We could not find that.',
  no_results: 'We could not find enough places there to build a trip.',
  invalid_request: 'Something about that request did not look right.',
  upstream_unavailable: 'One of our data providers is down. Please try again shortly.',
  timeout: 'That took too long. Please try again.',
  auth: 'One of the services we rely on turned us away. This is on our side — please try again shortly.',
  unknown: 'Something went wrong on our end.',
};

export function toUserMessage(error: unknown): string {
  if (error instanceof ServiceError) return error.userMessage;
  return DEFAULT_USER_MESSAGE.unknown;
}
