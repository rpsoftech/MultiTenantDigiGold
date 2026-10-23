import { useQuery } from '@tanstack/react-query';
import { marketplaceService } from '../marketplace.service';

// `enabled: false` is for a tenant that publishes its own products in the layout.
export function useTrendingProducts({
  enabled = true,
}: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['marketplace', 'trending'],
    queryFn: marketplaceService.getTrendingProducts,
    retry: false,
    enabled,
  });
}
