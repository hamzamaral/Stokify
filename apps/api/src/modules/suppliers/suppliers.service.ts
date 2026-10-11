import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginate, resolveSort } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../database/prisma.service';
import { CreateSupplierDto, SupplierQueryDto, UpdateSupplierDto } from './dto/supplier.dto';

const SORTABLE = ['name', 'createdAt'] as const;

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: SupplierQueryDto) {
    const where: Prisma.SupplierWhereInput = {
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.search && {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { taxNumber: { contains: query.search } },
          { contactName: { contains: query.search, mode: 'insensitive' } },
          { email: { contains: query.search, mode: 'insensitive' } },
        ],
      }),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        include: { _count: { select: { purchaseOrders: true } } },
        orderBy: resolveSort(query, SORTABLE, 'name'),
        skip: query.skip,
        take: query.limit,
      }),
      this.prisma.supplier.count({ where }),
    ]);
    return paginate(data, total, query);
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        purchaseOrders: { orderBy: { createdAt: 'desc' }, take: 10 },
        _count: { select: { purchaseOrders: true } },
      },
    });
    if (!supplier) throw new NotFoundException('Tedarikçi bulunamadı');
    return supplier;
  }

  create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: dto });
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOne(id);
    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    const supplier = await this.findOne(id);
    if (supplier._count.purchaseOrders > 0) {
      throw new ConflictException('Siparişi bulunan tedarikçi silinemez, pasifleştirebilirsiniz');
    }
    await this.prisma.supplier.delete({ where: { id } });
    return { id };
  }
}
