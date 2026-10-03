import { Mebo } from '@/features/mebo'

describe('Mebo', () => {
  const fetchMock = jest.fn()
  const originalFetch = fetch

  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock
  })

  afterAll(() => {
    globalThis.fetch = originalFetch
  })

  it('posts the configured agent and namespaced user id', async () => {
    const result = { utterance: 'hello', bestResponse: { utterance: 'hi' } }
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(result),
    })

    await expect(
      new Mebo('secret-key', 'agent-1').chat({
        utterance: 'hello',
        uid: 'user-2',
      })
    ).resolves.toEqual(result)

    expect(fetchMock).toHaveBeenCalledWith('https://api-mebo.dev/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: 'secret-key',
        agent_id: 'agent-1',
        utterance: 'hello',
        uid: 'jaotan-reply-user-2',
      }),
    })
  })

  it.each([
    ['non-success response', () => Promise.resolve({ ok: false })],
    [
      'network failure',
      () => {
        throw new Error('offline')
      },
    ],
  ])('returns null after a %s', async (_label, response) => {
    fetchMock.mockImplementation(response)

    await expect(
      new Mebo('key', 'agent').chat({ utterance: 'hello', uid: 'user' })
    ).resolves.toBeNull()
  })
})
