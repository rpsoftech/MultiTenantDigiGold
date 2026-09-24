import { useQuery } from '@tanstack/react-query';
import { marketplaceService } from '../marketplace.service';

export function useTrendingProducts() {
  return useQuery({
    queryKey: ['marketplace', 'trending'],
    queryFn: marketplaceService.getTrendingProducts,
  });
}
