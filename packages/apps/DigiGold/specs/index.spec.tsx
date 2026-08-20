import { redirect } from 'next/navigation';
import { ROUTES } from '../src/lib/constants/routes';
import Index from '../src/app/page';

jest.mock('next/navigation', () => ({ redirect: jest.fn() }));

describe('Index', () => {
  it('redirects to the login route', () => {
    Index();
    expect(redirect).toHaveBeenCalledWith(ROUTES.login);
  });
});
