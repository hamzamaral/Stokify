import { Role } from '@prisma/client';

export const DEMO_USERS: { email: string; password: string; fullName: string; role: Role }[] = [
  { email: 'admin@stokify.com', password: 'Admin123!', fullName: 'Ayşe Yılmaz', role: Role.ADMIN },
  {
    email: 'manager@stokify.com',
    password: 'Manager123!',
    fullName: 'Mehmet Demir',
    role: Role.MANAGER,
  },
  { email: 'staff@stokify.com', password: 'Staff123!', fullName: 'Can Kaya', role: Role.STAFF },
  {
    email: 'zeynep@stokify.com',
    password: 'Staff123!',
    fullName: 'Zeynep Arslan',
    role: Role.STAFF,
  },
  { email: 'emre@stokify.com', password: 'Staff123!', fullName: 'Emre Çelik', role: Role.STAFF },
];

export const DEMO_WAREHOUSES = [
  { code: 'IST-01', name: 'İstanbul Merkez Depo', location: 'Tuzla, İstanbul' },
  { code: 'ANK-01', name: 'Ankara Bölge Depo', location: 'Sincan, Ankara' },
  { code: 'IZM-01', name: 'İzmir Bölge Depo', location: 'Kemalpaşa, İzmir' },
];

type ProductTemplate = {
  names: string[];
  unit: string;
  price: [number, number];
  skuPrefix: string;
};

export const DEMO_CATEGORIES: {
  name: string;
  description: string;
  children: (ProductTemplate & { name: string; description: string })[];
}[] = [
  {
    name: 'Elektronik',
    description: 'Elektronik ürünler ve aksesuarlar',
    children: [
      {
        name: 'Bilgisayar',
        description: 'Dizüstü, masaüstü ve bileşenler',
        unit: 'adet',
        price: [4500, 65000],
        skuPrefix: 'BLG',
        names: [
          'Dizüstü Bilgisayar 14"',
          'Dizüstü Bilgisayar 15.6"',
          'Masaüstü İş İstasyonu',
          'Mini PC',
          'SSD 1TB NVMe',
          'SSD 512GB SATA',
          'RAM 16GB DDR5',
          'RAM 32GB DDR5',
          'Ekran Kartı RTX',
          'Harici Disk 2TB',
          'Monitör 27" IPS',
          'Monitör 24" FHD',
        ],
      },
      {
        name: 'Telefon & Aksesuar',
        description: 'Akıllı telefonlar ve aksesuarları',
        unit: 'adet',
        price: [150, 55000],
        skuPrefix: 'TLF',
        names: [
          'Akıllı Telefon 128GB',
          'Akıllı Telefon 256GB',
          'Hızlı Şarj Adaptörü 65W',
          'USB-C Kablo 1m',
          'USB-C Kablo 2m',
          'Kablosuz Şarj Pedi',
          'Powerbank 20000mAh',
          'Bluetooth Kulaklık',
          'Telefon Kılıfı Silikon',
          'Ekran Koruyucu Cam',
        ],
      },
      {
        name: 'Çevre Birimleri',
        description: 'Klavye, mouse, yazıcı vb.',
        unit: 'adet',
        price: [250, 18000],
        skuPrefix: 'CVR',
        names: [
          'Mekanik Klavye',
          'Kablosuz Klavye Mouse Seti',
          'Ergonomik Mouse',
          'Lazer Yazıcı',
          'Mürekkep Püskürtmeli Yazıcı',
          'Web Kamerası 1080p',
          'USB Hub 7 Port',
          'Mikrofon USB',
          'Docking Station',
          'Hoparlör Seti 2.1',
        ],
      },
    ],
  },
  {
    name: 'Ofis',
    description: 'Ofis malzemeleri',
    children: [
      {
        name: 'Kırtasiye',
        description: 'Kağıt, kalem ve sarf malzemeleri',
        unit: 'paket',
        price: [15, 450],
        skuPrefix: 'KRT',
        names: [
          "A4 Fotokopi Kağıdı 500'lü",
          "Tükenmez Kalem 50'li",
          "Kurşun Kalem 12'li",
          'Yapışkan Not Kağıdı',
          "Zımba Teli 1000'li",
          'Dosya Klasörü Geniş',
          "Şeffaf Dosya 100'lü",
          'Fosforlu Kalem Seti',
          'Spiralli Defter A4',
          'Toner Kartuşu Siyah',
          'Beyaz Tahta Kalemi Seti',
          "Ataç 100'lü",
        ],
      },
      {
        name: 'Ofis Mobilyası',
        description: 'Masa, sandalye ve depolama',
        unit: 'adet',
        price: [900, 22000],
        skuPrefix: 'MOB',
        names: [
          'Ergonomik Ofis Koltuğu',
          'Çalışma Masası 140cm',
          'Yükseklik Ayarlı Masa',
          'Toplantı Masası',
          'Çekmeceli Dolap',
          'Kitaplık 5 Raflı',
          'Misafir Sandalyesi',
          'Monitör Standı',
        ],
      },
    ],
  },
  {
    name: 'Gıda',
    description: 'Gıda ve içecek ürünleri',
    children: [
      {
        name: 'İçecek',
        description: 'Kahve, çay ve soğuk içecekler',
        unit: 'koli',
        price: [80, 1200],
        skuPrefix: 'ICK',
        names: [
          'Filtre Kahve 1kg',
          'Türk Kahvesi 500g',
          'Siyah Çay 1kg',
          "Yeşil Çay 20'li",
          "Maden Suyu 24'lü",
          "Su 0.5L 12'li",
          "Meyve Suyu 1L 12'li",
          "Kahve Kapsülü 50'li",
          'Bitki Çayı Seti',
          "Soğuk Kahve 12'li",
        ],
      },
      {
        name: 'Atıştırmalık',
        description: 'Bisküvi, kuruyemiş ve çikolata',
        unit: 'koli',
        price: [60, 900],
        skuPrefix: 'ATS',
        names: [
          "Bisküvi Çeşitleri 24'lü",
          'Karışık Kuruyemiş 1kg',
          "Bitter Çikolata 12'li",
          "Protein Bar 24'lü",
          "Kraker 20'li",
          "Gofret 36'lı",
          'Kuru Meyve Mix 500g',
          'Granola 1kg',
        ],
      },
    ],
  },
  {
    name: 'Temizlik & Hijyen',
    description: 'Temizlik ve kişisel hijyen ürünleri',
    children: [
      {
        name: 'Temizlik',
        description: 'Yüzey ve genel temizlik ürünleri',
        unit: 'koli',
        price: [45, 750],
        skuPrefix: 'TMZ',
        names: [
          'Yüzey Temizleyici 5L',
          'Çamaşır Suyu 4L',
          'Bulaşık Deterjanı 5L',
          'Cam Temizleyici 1L',
          'Çöp Poşeti Büyük',
          "Mikrofiber Bez 10'lu",
          'Paspas Seti',
          "Kağıt Havlu 12'li",
          "Tuvalet Kağıdı 32'li",
          'Sıvı Sabun 5L',
          'El Dezenfektanı 1L',
          "Islak Mendil 24'lü",
        ],
      },
    ],
  },
  {
    name: 'Ambalaj',
    description: 'Paketleme ve kargo malzemeleri',
    children: [
      {
        name: 'Paketleme',
        description: 'Koli, bant ve dolgu malzemeleri',
        unit: 'paket',
        price: [20, 650],
        skuPrefix: 'PKT',
        names: [
          "Koli 30x20x20 25'li",
          "Koli 50x40x40 20'li",
          "Koli Bandı Şeffaf 6'lı",
          'Balonlu Naylon 1m x 50m',
          'Streç Film 17mic',
          "Kargo Poşeti 100'lü",
          "Etiket Rulo 1000'li",
          'Köpük Dolgu 5kg',
          'Palet Ahşap',
          'Kraft Kağıt Rulo',
        ],
      },
    ],
  },
];
