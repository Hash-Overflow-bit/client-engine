import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateSend, type SendContext } from '../../../packages/outreach/src/index';
const ready: SendContext = { sendEnabled: true, mode: 'approval', approvedRevision: 'v1', currentRevision: 'v1', autoPolicyApproved: false, suppressed: false, do_not_contact: false, emailVerified: true, replyReceived: false, meetingBooked: false, sentToday: 0, dailyLimit: 10 };
describe('send policy', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('permits the current approved revision in production', () => expect(evaluateSend(ready, 'production').allowed).toBe(true));
  it('blocks the global outbound kill switch', () => expect(evaluateSend(ready, 'production', { killSwitchEnabled: true }).allowed).toBe(false));
  it('blocks persisted workspace kill-switch state', () => expect(evaluateSend({ ...ready, globalKillSwitch: true }, 'production', { killSwitchEnabled: false }).allowed).toBe(false));
  it.each([
    ['disabled', { sendEnabled: false }], ['edited', { currentRevision: 'v2' }], ['unapproved', { approvedRevision: null }], ['suppressed', { suppressed: true }], ['do not contact', { do_not_contact: true }], ['replied', { replyReceived: true }], ['booked', { meetingBooked: true }], ['unverified', { emailVerified: false }], ['capped', { sentToday: 10 }], ['invalid limit', { dailyLimit: Number.NaN }], ['invalid count', { sentToday: -1 }], ['automatic unapproved', { mode: 'auto', autoPolicyApproved: false }],
  ] as const)('blocks %s', (_name, change) => expect(evaluateSend({ ...ready, ...change }, 'production').allowed).toBe(false));
  it.each(['development', 'test', 'preview', ''])('blocks all sends in %s', (environment) => expect(evaluateSend(ready, environment).allowed).toBe(false));
  it.each([null, {}, { ...ready, do_not_contact: undefined }, { ...ready, do_not_contact: 'false' }, { ...ready, mode: 'invalid' }, { ...ready, extra: true }])('rejects malformed input', (input) => expect(evaluateSend(input, 'production').allowed).toBe(false));
  it('lets a reply stop an approved automatic campaign', () => expect(evaluateSend({ ...ready, mode: 'auto', autoPolicyApproved: true, replyReceived: true }, 'production').allowed).toBe(false));
  it('allows an approved automatic policy in production', () => expect(evaluateSend({ ...ready, mode: 'auto', autoPolicyApproved: true }, 'production').allowed).toBe(true));
  it('fails closed when the trusted deployment environment is missing', () => {
    vi.stubEnv('CLIENT_ENGINE_ENV', '');
    expect(evaluateSend(ready).allowed).toBe(false);
  });
});
