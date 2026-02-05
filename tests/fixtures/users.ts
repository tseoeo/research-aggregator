/**
 * User Test Fixtures
 *
 * Sample user data for testing authentication scenarios.
 */

export function createUserFixture(overrides: Partial<{
  id: string;
  name: string;
  email: string;
  image: string;
}> = {}) {
  const randomNum = Math.floor(Math.random() * 100000);

  return {
    id: overrides.id || `user-${randomNum}`,
    name: overrides.name || 'Test User',
    email: overrides.email || `testuser${randomNum}@example.com`,
    image: overrides.image || `https://avatars.example.com/u/${randomNum}`,
  };
}

/**
 * Create a mock session object
 */
export function createSessionFixture(user = createUserFixture()) {
  return {
    user,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/**
 * Create a null session for unauthenticated state
 */
export function createNullSession() {
  return null;
}
