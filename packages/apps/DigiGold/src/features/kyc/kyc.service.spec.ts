import { apiClient } from '@/lib/api/client';
import { kycService } from './kyc.service';

jest.mock('@/lib/api/client', () => ({
  apiClient: { post: jest.fn() },
}));

const mockedClient = apiClient as jest.Mocked<typeof apiClient>;

describe('kycService.submitKyc', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts the payload to /user/kyc and returns the response body', async () => {
    const body = { success: true, message: 'KYC document uploaded and pending verification' };
    mockedClient.post.mockResolvedValue({ data: body });

    const payload = { pan_number: 'ABCDE1234F', aadhaar_last4: '1234' };
    const result = await kycService.submitKyc(payload);

    expect(mockedClient.post).toHaveBeenCalledWith('/user/kyc', payload);
    expect(result).toEqual(body);
  });

  it('passes the optional document url through when provided', async () => {
    mockedClient.post.mockResolvedValue({ data: { success: true, message: '' } });
    const payload = {
      pan_number: 'ABCDE1234F',
      aadhaar_last4: '1234',
      document_url: 'https://example.com/doc.pdf',
    };

    await kycService.submitKyc(payload);

    expect(mockedClient.post).toHaveBeenCalledWith('/user/kyc', payload);
  });

  it('lets request errors reach the caller', async () => {
    mockedClient.post.mockRejectedValue({ message: 'boom', code: 'X', status: 500 });
    await expect(
      kycService.submitKyc({ pan_number: 'ABCDE1234F', aadhaar_last4: '1234' }),
    ).rejects.toMatchObject({ status: 500 });
  });
});
