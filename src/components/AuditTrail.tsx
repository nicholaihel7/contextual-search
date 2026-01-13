/**
 * AuditTrail.tsx
 * PropLedger için İşlem Geçmişi Komponenti
 * 
 * Her işlem kayıt altında:
 * - Kim yaptı
 * - Ne zaman yaptı
 * - Ne yaptı
 * - CTG ID ile izlenebilir
 * 
 * Özellikler:
 * - Append-only (silinemez)
 * - Filtreleme (tarih, kullanıcı, işlem tipi)
 * - Export (PDF/Excel için hazır)
 */

import React, { useState, useMemo } from 'react';
import { 
  History, 
  User, 
  Calendar, 
  Filter, 
  Download,
  FileText,
  DollarSign,
  Users,
  Upload,
  Edit,
  Trash,
  Eye,
  ChevronDown,
  ChevronUp,
  Search,
  Shield
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ============================================
// Types
// ============================================

type AuditActionType = 
  | 'property_created'
  | 'property_updated'
  | 'price_updated'
  | 'share_created'
  | 'share_transferred'
  | 'document_uploaded'
  | 'document_updated'
  | 'user_added'
  | 'user_removed'
  | 'contract_signed'
  | 'payment_received'
  | 'view_accessed';

interface AuditEntry {
  id: string;
  ctgId: number;           // CTG Node ID - izlenebilirlik için
  timestamp: Date;
  userId: string;
  userName: string;
  action: AuditActionType;
  entityType: 'property' | 'share' | 'document' | 'user' | 'payment';
  entityId: string;
  entityName: string;
  details: Record<string, any>;
  ipAddress?: string;
  previousValue?: string;
  newValue?: string;
}

// ============================================
// Mock Data Generator (Gerçek uygulamada API'den gelir)
// ============================================

function generateMockAuditData(propertyId?: string): AuditEntry[] {
  const now = new Date();
  const users = [
    { id: 'u1', name: 'Ahmet Yılmaz' },
    { id: 'u2', name: 'Mehmet Kaya' },
    { id: 'u3', name: 'Ayşe Demir' },
    { id: 'u4', name: 'Fatma Öztürk' },
  ];

  const entries: AuditEntry[] = [
    {
      id: 'audit_1',
      ctgId: 5,
      timestamp: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      userId: 'u1',
      userName: 'Ahmet Yılmaz',
      action: 'property_created',
      entityType: 'property',
      entityId: 'prop_1',
      entityName: 'Maslak Tower',
      details: { address: 'Maslak, İstanbul', area: 5000 },
    },
    {
      id: 'audit_2',
      ctgId: 10,
      timestamp: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
      userId: 'u1',
      userName: 'Ahmet Yılmaz',
      action: 'price_updated',
      entityType: 'property',
      entityId: 'prop_1',
      entityName: 'Maslak Tower',
      details: { currency: 'USD' },
      previousValue: '0',
      newValue: '5,000,000',
    },
    {
      id: 'audit_3',
      ctgId: 3,
      timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      userId: 'u2',
      userName: 'Mehmet Kaya',
      action: 'share_created',
      entityType: 'share',
      entityId: 'share_1',
      entityName: 'Hisse #1',
      details: { percentage: 40, owner: 'Ahmet Yılmaz', propertyName: 'Maslak Tower' },
    },
    {
      id: 'audit_4',
      ctgId: 13,
      timestamp: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      userId: 'u2',
      userName: 'Mehmet Kaya',
      action: 'share_created',
      entityType: 'share',
      entityId: 'share_2',
      entityName: 'Hisse #2',
      details: { percentage: 35, owner: 'Mehmet Kaya', propertyName: 'Maslak Tower' },
    },
    {
      id: 'audit_5',
      ctgId: 53,
      timestamp: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
      userId: 'u3',
      userName: 'Ayşe Demir',
      action: 'share_created',
      entityType: 'share',
      entityId: 'share_3',
      entityName: 'Hisse #3',
      details: { percentage: 25, owner: 'Ayşe Demir', propertyName: 'Maslak Tower' },
    },
    {
      id: 'audit_6',
      ctgId: 118,
      timestamp: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      userId: 'u1',
      userName: 'Ahmet Yılmaz',
      action: 'document_uploaded',
      entityType: 'document',
      entityId: 'doc_1',
      entityName: 'Satış Sözleşmesi',
      details: { fileSize: '245 KB', fileType: 'PDF', propertyName: 'Maslak Tower' },
    },
    {
      id: 'audit_7',
      ctgId: 20,
      timestamp: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      userId: 'u4',
      userName: 'Fatma Öztürk',
      action: 'price_updated',
      entityType: 'property',
      entityId: 'prop_1',
      entityName: 'Maslak Tower',
      details: { currency: 'USD', reason: 'Piyasa değerlemesi' },
      previousValue: '5,000,000',
      newValue: '5,500,000',
    },
    {
      id: 'audit_8',
      ctgId: 236,
      timestamp: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      userId: 'u3',
      userName: 'Ayşe Demir',
      action: 'contract_signed',
      entityType: 'document',
      entityId: 'doc_1',
      entityName: 'Satış Sözleşmesi',
      details: { signatureType: 'e-imza', propertyName: 'Maslak Tower' },
    },
    {
      id: 'audit_9',
      ctgId: 472,
      timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000),
      userId: 'u2',
      userName: 'Mehmet Kaya',
      action: 'payment_received',
      entityType: 'payment',
      entityId: 'pay_1',
      entityName: 'Taksit #1',
      details: { amount: '500,000 USD', method: 'Banka transferi', propertyName: 'Maslak Tower' },
    },
    {
      id: 'audit_10',
      ctgId: 944,
      timestamp: new Date(now.getTime() - 2 * 60 * 60 * 1000),
      userId: 'u1',
      userName: 'Ahmet Yılmaz',
      action: 'view_accessed',
      entityType: 'property',
      entityId: 'prop_1',
      entityName: 'Maslak Tower',
      details: { section: 'Sözleşme detayları' },
      ipAddress: '192.168.1.***',
    },
  ];

  return entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

// ============================================
// Helper Functions
// ============================================

const actionLabels: Record<AuditActionType, string> = {
  property_created: 'Mülk oluşturuldu',
  property_updated: 'Mülk güncellendi',
  price_updated: 'Fiyat güncellendi',
  share_created: 'Hisse oluşturuldu',
  share_transferred: 'Hisse transfer edildi',
  document_uploaded: 'Doküman yüklendi',
  document_updated: 'Doküman güncellendi',
  user_added: 'Kullanıcı eklendi',
  user_removed: 'Kullanıcı çıkarıldı',
  contract_signed: 'Sözleşme imzalandı',
  payment_received: 'Ödeme alındı',
  view_accessed: 'Görüntülendi',
};

const actionIcons: Record<AuditActionType, React.ReactNode> = {
  property_created: <FileText className="h-4 w-4" />,
  property_updated: <Edit className="h-4 w-4" />,
  price_updated: <DollarSign className="h-4 w-4" />,
  share_created: <Users className="h-4 w-4" />,
  share_transferred: <Users className="h-4 w-4" />,
  document_uploaded: <Upload className="h-4 w-4" />,
  document_updated: <Edit className="h-4 w-4" />,
  user_added: <User className="h-4 w-4" />,
  user_removed: <Trash className="h-4 w-4" />,
  contract_signed: <FileText className="h-4 w-4" />,
  payment_received: <DollarSign className="h-4 w-4" />,
  view_accessed: <Eye className="h-4 w-4" />,
};

const actionColors: Record<AuditActionType, string> = {
  property_created: 'bg-green-100 text-green-800',
  property_updated: 'bg-blue-100 text-blue-800',
  price_updated: 'bg-purple-100 text-purple-800',
  share_created: 'bg-orange-100 text-orange-800',
  share_transferred: 'bg-orange-100 text-orange-800',
  document_uploaded: 'bg-cyan-100 text-cyan-800',
  document_updated: 'bg-cyan-100 text-cyan-800',
  user_added: 'bg-green-100 text-green-800',
  user_removed: 'bg-red-100 text-red-800',
  contract_signed: 'bg-emerald-100 text-emerald-800',
  payment_received: 'bg-green-100 text-green-800',
  view_accessed: 'bg-gray-100 text-gray-800',
};

function formatDate(date: Date): string {
  return date.toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Az önce';
  if (diffMins < 60) return `${diffMins} dakika önce`;
  if (diffHours < 24) return `${diffHours} saat önce`;
  if (diffDays < 7) return `${diffDays} gün önce`;
  return formatDate(date);
}

// ============================================
// Components
// ============================================

interface AuditEntryRowProps {
  entry: AuditEntry;
  expanded: boolean;
  onToggle: () => void;
}

const AuditEntryRow: React.FC<AuditEntryRowProps> = ({ entry, expanded, onToggle }) => {
  return (
    <div className="border rounded-lg mb-2 overflow-hidden">
      {/* Ana satır */}
      <div 
        className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
        {/* İkon */}
        <div className={`p-2 rounded-full ${actionColors[entry.action]}`}>
          {actionIcons[entry.action]}
        </div>

        {/* İçerik */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">{entry.userName}</span>
            <span className="text-muted-foreground">•</span>
            <span>{actionLabels[entry.action]}</span>
            <Badge variant="outline" className="text-xs">
              {entry.entityName}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
            <Calendar className="h-3 w-3" />
            {formatRelativeTime(entry.timestamp)}
            <span className="text-xs">•</span>
            <span className="text-xs font-mono">CTG:{entry.ctgId}</span>
          </div>
        </div>

        {/* Değişiklik göstergesi */}
        {entry.previousValue && entry.newValue && (
          <div className="text-sm text-right hidden sm:block">
            <span className="text-red-500 line-through">{entry.previousValue}</span>
            <span className="mx-1">→</span>
            <span className="text-green-600 font-medium">{entry.newValue}</span>
          </div>
        )}

        {/* Expand ikonu */}
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Detay paneli */}
      {expanded && (
        <div className="px-4 pb-3 pt-1 bg-gray-50 border-t">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">İşlem ID:</span>
              <span className="ml-2 font-mono">{entry.id}</span>
            </div>
            <div>
              <span className="text-muted-foreground">CTG Node:</span>
              <span className="ml-2 font-mono">{entry.ctgId}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Tarih:</span>
              <span className="ml-2">{formatDate(entry.timestamp)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Kullanıcı ID:</span>
              <span className="ml-2 font-mono">{entry.userId}</span>
            </div>
            {entry.ipAddress && (
              <div>
                <span className="text-muted-foreground">IP Adresi:</span>
                <span className="ml-2 font-mono">{entry.ipAddress}</span>
              </div>
            )}
            {Object.entries(entry.details).map(([key, value]) => (
              <div key={key}>
                <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                <span className="ml-2">{String(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// Main Component
// ============================================

interface AuditTrailProps {
  propertyId?: string;
  propertyName?: string;
  limit?: number;
}

const AuditTrail: React.FC<AuditTrailProps> = ({ propertyId, propertyName, limit }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Mock data (gerçek uygulamada API'den gelir)
  const allEntries = useMemo(() => generateMockAuditData(propertyId), [propertyId]);

  // Benzersiz kullanıcılar
  const uniqueUsers = useMemo(() => {
    const users = new Map<string, string>();
    allEntries.forEach(e => users.set(e.userId, e.userName));
    return Array.from(users.entries());
  }, [allEntries]);

  // Filtreleme
  const filteredEntries = useMemo(() => {
    let result = allEntries;

    // İşlem tipi filtresi
    if (actionFilter !== 'all') {
      result = result.filter(e => e.action === actionFilter);
    }

    // Kullanıcı filtresi
    if (userFilter !== 'all') {
      result = result.filter(e => e.userId === userFilter);
    }

    // Arama
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(e => 
        e.userName.toLowerCase().includes(query) ||
        e.entityName.toLowerCase().includes(query) ||
        actionLabels[e.action].toLowerCase().includes(query) ||
        String(e.ctgId).includes(query)
      );
    }

    return result;
  }, [allEntries, actionFilter, userFilter, searchQuery]);

  // Limit uygula
  const displayedEntries = useMemo(() => {
    if (showAll || !limit) return filteredEntries;
    return filteredEntries.slice(0, limit);
  }, [filteredEntries, limit, showAll]);

  // Export fonksiyonu
  const handleExport = () => {
    const csv = [
      ['Tarih', 'Kullanıcı', 'İşlem', 'Varlık', 'CTG ID', 'Önceki Değer', 'Yeni Değer'].join(','),
      ...filteredEntries.map(e => [
        formatDate(e.timestamp),
        e.userName,
        actionLabels[e.action],
        e.entityName,
        e.ctgId,
        e.previousValue || '',
        e.newValue || ''
      ].map(v => `"${v}"`).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit_trail_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            İşlem Geçmişi
            {propertyName && (
              <Badge variant="outline" className="ml-2">{propertyName}</Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              {filteredEntries.length} kayıt
            </Badge>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* Filtreler */}
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ara (kullanıcı, varlık, CTG ID...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="İşlem tipi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm işlemler</SelectItem>
              <SelectItem value="property_created">Mülk oluşturma</SelectItem>
              <SelectItem value="price_updated">Fiyat güncelleme</SelectItem>
              <SelectItem value="share_created">Hisse oluşturma</SelectItem>
              <SelectItem value="document_uploaded">Doküman yükleme</SelectItem>
              <SelectItem value="contract_signed">Sözleşme imza</SelectItem>
              <SelectItem value="payment_received">Ödeme</SelectItem>
              <SelectItem value="view_accessed">Görüntüleme</SelectItem>
            </SelectContent>
          </Select>

          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-[180px]">
              <User className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Kullanıcı" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm kullanıcılar</SelectItem>
              {uniqueUsers.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Liste */}
        <div className="space-y-1">
          {displayedEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Kayıt bulunamadı
            </div>
          ) : (
            displayedEntries.map(entry => (
              <AuditEntryRow
                key={entry.id}
                entry={entry}
                expanded={expandedId === entry.id}
                onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              />
            ))
          )}
        </div>

        {/* Daha fazla göster */}
        {limit && filteredEntries.length > limit && !showAll && (
          <div className="text-center mt-4">
            <Button variant="outline" onClick={() => setShowAll(true)}>
              Tümünü göster ({filteredEntries.length - limit} daha)
            </Button>
          </div>
        )}

        {/* Açıklama */}
        <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
          <Shield className="h-4 w-4 inline mr-1" />
          <strong>Güvenlik:</strong> Tüm işlemler CTG ID ile kaydedilir ve silinemez. 
          Her kayıt matematiksel olarak izlenebilir ve doğrulanabilir.
        </div>
      </CardContent>
    </Card>
  );
};

export default AuditTrail;
