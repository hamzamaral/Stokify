import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate, PaginationQueryDto, resolveSort } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

const SORTABLE = ['name', 'createdAt'] as const;

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: PaginationQueryDto) {
    const where: Prisma.CategoryWhereInput = query.search
      ? { name: { contains: query.search, mode: 'insensitive' } }
      : {};
    const [data, total] = await this.prisma.$transaction([
      this.prisma.category.findMany({
        where,
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { products: { where: { deletedAt: null } }, children: true } },
        },
        orderBy: resolveSort(query, SORTABLE, 'name'),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.category.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  /** Tüm kategorileri ağaç yapısında döner (formlardaki seçim listeleri için). */
  async tree() {
    const categories = await this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
    });
    type Node = (typeof categories)[number] & { children: Node[] };
    const nodes = new Map<string, Node>(categories.map((c) => [c.id, { ...c, children: [] }]));
    const roots: Node[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      (parent ? parent.children : roots).push(node);
    }
    return roots;
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { parent: true, children: true },
    });
    if (!category) throw new NotFoundException('Kategori bulunamadı');
    return category;
  }

  async create(dto: CreateCategoryDto) {
    if (dto.parentId) await this.findOne(dto.parentId);
    return this.prisma.category.create({ data: dto });
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);
    if (dto.parentId) {
      if (dto.parentId === id)
        throw new BadRequestException('Kategori kendisinin üst kategorisi olamaz');
      await this.assertNotDescendant(id, dto.parentId);
    }
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });
    if (!category) throw new NotFoundException('Kategori bulunamadı');
    if (category._count.products > 0) {
      throw new ConflictException('Ürün içeren kategori silinemez');
    }
    await this.prisma.category.delete({ where: { id } });
    return { id };
  }

  /** Döngüsel hiyerarşiyi engeller: yeni üst kategori, mevcut kategorinin alt dalında olamaz. */
  private async assertNotDescendant(id: string, newParentId: string) {
    let cursor: string | null = newParentId;
    while (cursor) {
      if (cursor === id)
        throw new BadRequestException('Döngüsel kategori hiyerarşisi oluşturulamaz');
      const parent: { parentId: string | null } | null = await this.prisma.category.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = parent?.parentId ?? null;
    }
  }
}
