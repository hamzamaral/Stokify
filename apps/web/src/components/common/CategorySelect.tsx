import { forwardRef } from 'react';
import { Select } from '@/components/ui/input';
import { useCategoryTree } from '@/lib/queries';
import type { Category } from '@/types/api';

const flatten = (nodes: Category[], depth = 0): { id: string; label: string }[] =>
  nodes.flatMap((n) => [
    { id: n.id, label: `${'\u00A0\u00A0\u00A0'.repeat(depth)}${n.name}` },
    ...flatten(n.children ?? [], depth + 1),
  ]);

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  placeholder?: string;
  excludeId?: string;
};

export const CategorySelect = forwardRef<HTMLSelectElement, Props>(
  ({ placeholder = 'Kategori seçin', excludeId, ...props }, ref) => {
    const { data = [] } = useCategoryTree();
    return (
      <Select ref={ref} {...props}>
        <option value="">{placeholder}</option>
        {flatten(data)
          .filter((c) => c.id !== excludeId)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
      </Select>
    );
  },
);
CategorySelect.displayName = 'CategorySelect';
