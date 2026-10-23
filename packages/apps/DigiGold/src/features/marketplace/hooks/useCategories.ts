import { useQuery } from '@tanstack/react-query';
import { marketplaceService } from '../marketplace.service';

// `enabled: false` is for a tenant that publishes its own categories in the layout.
export function useCategories({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ['marketplace', 'categories'],
    queryFn: marketplaceService.getCategories,
    retry: false,
    enabled,
  });
}
