import { useQuery } from '@tanstack/react-query';
import { marketplaceService } from '../marketplace.service';

export function useCategories() {
  return useQuery({
    queryKey: ['marketplace', 'categories'],
    queryFn: marketplaceService.getCategories,
  });
}
