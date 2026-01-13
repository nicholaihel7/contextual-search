/**
 * ContractVersioning.tsx
 * PropLedger için Sözleşme Versiyonlama Komponenti
 * 
 * Özellikler:
 * - Versiyon listesi (CTG pillar yapısında)
 * - Değişiklik karşılaştırması (diff)
 * - Versiyon detayları
 * - Geri yükleme
 */

import React, { useState, useMemo } from 'react';
import {
  GitBranch,
  Clock,
  User,
  FileText,
  Plus,
  Minus,
  Eye,
  RotateCcw,
  ChevronRight,
  Check,
  AlertCircle,
  History,
  ArrowRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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

interface ContractVersion {
  id: string;
  ctgId: number;
  versionNumber: number;
  title: string;
  content: string;
  createdAt: Date;
  createdBy: string;
  changeNote: string;
  status: 'draft' | 'active' | 'archived';
  changes?: {
    added: number;
    removed: number;
    modified: number;
  };
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber?: number;
}

// ============================================
// CTG Pillar Logic
// ============================================

function getNextVersionCTG(currentCTG: number): number {
  return currentCTG * 2;
}

function getVersionChain(baseCTG: number, count: number): number[] {
  const chain: number[] = [baseCTG];
  let current = baseCTG;
  for (let i = 1; i < count; i++) {
    current = current * 2;
    chain.push(current);
  }
  return chain;
}

// ============================================
// Diff Algorithm
// ============================================

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const diff: DiffLine[] = [];

  // Basit satır bazlı diff (gerçek uygulamada daha sofistike algoritma kullanılır)
  const oldSet = new Set(oldLines);
  const newSet = new Set(newLines);

  let oldIdx = 0;
  let newIdx = 0;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const oldLine = oldLines[oldIdx];
    const newLine = newLines[newIdx];

    if (oldIdx >= oldLines.length) {
      // Eski bitti, yeni satırlar eklendi
      diff.push({ type: 'added', content: newLine, lineNumber: newIdx + 1 });
      newIdx++;
    } else if (newIdx >= newLines.length) {
      // Yeni bitti, eski satırlar silindi
      diff.push({ type: 'removed', content: oldLine, lineNumber: oldIdx + 1 });
      oldIdx++;
    } else if (oldLine === newLine) {
      // Aynı satır
      diff.push({ type: 'unchanged', content: oldLine });
      oldIdx++;
      newIdx++;
    } else if (!newSet.has(oldLine)) {
      // Eski satır silindi
      diff.push({ type: 'removed', content: oldLine, lineNumber: oldIdx + 1 });
      oldIdx++;
    } else if (!oldSet.has(newLine)) {
      // Yeni satır eklendi
      diff.push({ type: 'added', content: newLine, lineNumber: newIdx + 1 });
      newIdx++;
    } else {
      // Değişiklik
      diff.push({ type: 'removed', content: oldLine, lineNumber: oldIdx + 1 });
      diff.push({ type: 'added', content: newLine, lineNumber: newIdx + 1 });
      oldIdx++;
      newIdx++;
    }
  }

  return diff;
}

function countChanges(diff: DiffLine[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const line of diff) {
    if (line.type === 'added') added++;
    if (line.type === 'removed') removed++;
  }
  return { added, removed };
}

// ============================================
// Mock Data
// ============================================

function generateMockVersions(propertyName?: string): ContractVersion[] {
  const baseCTG = 118;
  const ctgChain = getVersionChain(baseCTG, 4);

  return [
    {
      id: 'v1',
      ctgId: ctgChain[0],
      versionNumber: 1,
      title: 'Satış Sözleşmesi',
      content: `TAŞINMAZ SATIŞ SÖZLEŞMESİ

Madde 1: Taraflar
Bu sözleşme, satıcı ve alıcı arasında imzalanmıştır.

Madde 2: Satış Bedeli
Toplam satış bedeli 5.000.000 USD'dir.
Ödeme peşin yapılacaktır.

Madde 3: Devir
Tapu devri 30 gün içinde yapılacaktır.`,
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      createdBy: 'Ahmet Yılmaz',
      changeNote: 'İlk sözleşme taslağı',
      status: 'archived',
    },
    {
      id: 'v2',
      ctgId: ctgChain[1],
      versionNumber: 2,
      title: 'Satış Sözleşmesi',
      content: `TAŞINMAZ SATIŞ SÖZLEŞMESİ

Madde 1: Taraflar
Bu sözleşme, satıcı ve alıcı arasında imzalanmıştır.
Taraflar tüm şartları kabul etmiştir.

Madde 2: Satış Bedeli
Toplam satış bedeli 5.500.000 USD'dir.
Ödeme taksitle yapılacaktır.
İlk taksit: 1.000.000 USD

Madde 3: Devir
Tapu devri 30 gün içinde yapılacaktır.

Madde 4: Gecikme
Gecikme durumunda %2 ceza uygulanır.`,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      createdBy: 'Mehmet Kaya',
      changeNote: 'Fiyat güncellendi, taksit eklendi, gecikme maddesi eklendi',
      status: 'archived',
      changes: { added: 6, removed: 2, modified: 1 },
    },
    {
      id: 'v3',
      ctgId: ctgChain[2],
      versionNumber: 3,
      title: 'Satış Sözleşmesi',
      content: `TAŞINMAZ SATIŞ SÖZLEŞMESİ

Madde 1: Taraflar
Bu sözleşme, satıcı ve alıcı arasında imzalanmıştır.
Taraflar tüm şartları kabul etmiştir.

Madde 2: Satış Bedeli
Toplam satış bedeli 5.500.000 USD'dir.
Ödeme taksitle yapılacaktır.
İlk taksit: 1.000.000 USD
Kalan taksitler: 6 eşit taksit

Madde 3: Devir
Tapu devri ödeme tamamlandıktan sonra yapılacaktır.

Madde 4: Gecikme
Gecikme durumunda aylık %2 ceza uygulanır.
30 günden fazla gecikmede sözleşme feshedilebilir.

Madde 5: Cayma Hakkı
Alıcı 14 gün içinde cayma hakkını kullanabilir.
Cayma durumunda %10 kesinti uygulanır.`,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      createdBy: 'Ayşe Demir',
      changeNote: 'Taksit detayları, cayma hakkı maddesi eklendi',
      status: 'active',
      changes: { added: 5, removed: 1, modified: 2 },
    },
  ];
}

// ============================================
// Components
// ============================================

interface VersionTimelineProps {
  versions: ContractVersion[];
  selectedVersion: ContractVersion | null;
  onSelectVersion: (version: ContractVersion) => void;
}

const VersionTimeline: React.FC<VersionTimelineProps> = ({
  versions,
  selectedVersion,
  onSelectVersion,
}) => {
  return (
    <div className="space-y-2">
      {versions.map((version, idx) => (
        <div
          key={version.id}
          className={`
            p-3 rounded-lg border cursor-pointer transition-all
            ${selectedVersion?.id === version.id
              ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
              : 'hover:bg-gray-50'
            }
          `}
          onClick={() => onSelectVersion(version)}
        >
          <div className="flex items-start gap-3">
            {/* Timeline dot */}
            <div className="flex flex-col items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${version.status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
                }
              `}>
                v{version.versionNumber}
              </div>
              {idx < versions.length - 1 && (
                <div className="w-0.5 h-8 bg-gray-200 mt-1" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{version.title}</span>
                {version.status === 'active' && (
                  <Badge className="bg-green-100 text-green-700">Aktif</Badge>
                )}
                <Badge variant="outline" className="font-mono text-xs">
                  CTG:{version.ctgId}
                </Badge>
              </div>
              
              <p className="text-sm text-muted-foreground mt-1">
                {version.changeNote}
              </p>
              
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {version.createdBy}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {version.createdAt.toLocaleDateString('tr-TR')}
                </span>
                {version.changes && (
                  <span className="flex items-center gap-1">
                    <Plus className="h-3 w-3 text-green-600" />
                    {version.changes.added}
                    <Minus className="h-3 w-3 text-red-600 ml-1" />
                    {version.changes.removed}
                  </span>
                )}
              </div>
            </div>

            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      ))}
    </div>
  );
};

interface DiffViewerProps {
  oldVersion: ContractVersion;
  newVersion: ContractVersion;
}

const DiffViewer: React.FC<DiffViewerProps> = ({ oldVersion, newVersion }) => {
  const diff = useMemo(
    () => computeDiff(oldVersion.content, newVersion.content),
    [oldVersion.content, newVersion.content]
  );

  const changes = useMemo(() => countChanges(diff), [diff]);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <Badge variant="outline">v{oldVersion.versionNumber}</Badge>
          <ArrowRight className="h-4 w-4" />
          <Badge variant="default">v{newVersion.versionNumber}</Badge>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-green-600 flex items-center gap-1">
            <Plus className="h-4 w-4" /> {changes.added} eklendi
          </span>
          <span className="text-red-600 flex items-center gap-1">
            <Minus className="h-4 w-4" /> {changes.removed} silindi
          </span>
        </div>
      </div>

      {/* Diff content */}
      <div className="border rounded-lg overflow-hidden font-mono text-sm">
        {diff.map((line, idx) => (
          <div
            key={idx}
            className={`
              px-3 py-1 border-b last:border-b-0
              ${line.type === 'added' ? 'bg-green-50 text-green-800' : ''}
              ${line.type === 'removed' ? 'bg-red-50 text-red-800' : ''}
              ${line.type === 'unchanged' ? 'bg-white text-gray-600' : ''}
            `}
          >
            <span className="inline-block w-6 text-gray-400 select-none">
              {line.type === 'added' && '+'}
              {line.type === 'removed' && '-'}
              {line.type === 'unchanged' && ' '}
            </span>
            {line.content || ' '}
          </div>
        ))}
      </div>
    </div>
  );
};

// ============================================
// Main Component
// ============================================

interface ContractVersioningProps {
  propertyId?: string;
  propertyName?: string;
  contractId?: string;
}

const ContractVersioning: React.FC<ContractVersioningProps> = ({
  propertyId,
  propertyName,
  contractId,
}) => {
  const [versions, setVersions] = useState<ContractVersion[]>(() =>
    generateMockVersions(propertyName)
  );
  const [selectedVersion, setSelectedVersion] = useState<ContractVersion | null>(
    versions[versions.length - 1]
  );
  const [compareMode, setCompareMode] = useState(false);
  const [compareWith, setCompareWith] = useState<string | null>(null);
  const [showNewVersionDialog, setShowNewVersionDialog] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [changeNote, setChangeNote] = useState('');

  // Aktif versiyon
  const activeVersion = versions.find((v) => v.status === 'active');

  // Karşılaştırılacak versiyon
  const compareVersion = compareWith
    ? versions.find((v) => v.id === compareWith)
    : null;

  // Yeni versiyon oluştur
  const handleCreateVersion = () => {
    if (!newContent.trim() || !changeNote.trim()) return;

    const lastVersion = versions[versions.length - 1];
    const newCTG = getNextVersionCTG(lastVersion.ctgId);

    const newVersion: ContractVersion = {
      id: `v${versions.length + 1}`,
      ctgId: newCTG,
      versionNumber: versions.length + 1,
      title: lastVersion.title,
      content: newContent,
      createdAt: new Date(),
      createdBy: 'Mevcut Kullanıcı', // Gerçek uygulamada auth'dan gelir
      changeNote,
      status: 'active',
      changes: countChanges(computeDiff(lastVersion.content, newContent)),
    };

    // Önceki aktif versiyonu arşivle
    const updatedVersions = versions.map((v) =>
      v.status === 'active' ? { ...v, status: 'archived' as const } : v
    );

    setVersions([...updatedVersions, newVersion]);
    setSelectedVersion(newVersion);
    setShowNewVersionDialog(false);
    setNewContent('');
    setChangeNote('');
  };

  // Versiyona geri dön
  const handleRestoreVersion = (version: ContractVersion) => {
    if (version.status === 'active') return;

    const newCTG = getNextVersionCTG(versions[versions.length - 1].ctgId);

    const restoredVersion: ContractVersion = {
      id: `v${versions.length + 1}`,
      ctgId: newCTG,
      versionNumber: versions.length + 1,
      title: version.title,
      content: version.content,
      createdAt: new Date(),
      createdBy: 'Mevcut Kullanıcı',
      changeNote: `v${version.versionNumber} geri yüklendi`,
      status: 'active',
    };

    const updatedVersions = versions.map((v) =>
      v.status === 'active' ? { ...v, status: 'archived' as const } : v
    );

    setVersions([...updatedVersions, restoredVersion]);
    setSelectedVersion(restoredVersion);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Sözleşme Versiyonları
              {propertyName && (
                <Badge variant="outline" className="ml-2">{propertyName}</Badge>
              )}
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant={compareMode ? 'default' : 'outline'}
                size="sm"
                onClick={() => setCompareMode(!compareMode)}
              >
                <History className="h-4 w-4 mr-1" />
                Karşılaştır
              </Button>
              <Button size="sm" onClick={() => {
                setNewContent(activeVersion?.content || '');
                setShowNewVersionDialog(true);
              }}>
                <Plus className="h-4 w-4 mr-1" />
                Yeni Versiyon
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sol: Versiyon Listesi */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Geçmiş ({versions.length} versiyon)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VersionTimeline
              versions={[...versions].reverse()}
              selectedVersion={selectedVersion}
              onSelectVersion={setSelectedVersion}
            />
          </CardContent>
        </Card>

        {/* Sağ: Detay veya Karşılaştırma */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {compareMode ? (
                  <>
                    <History className="h-4 w-4" />
                    Değişiklikleri Karşılaştır
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    Versiyon Detayı
                  </>
                )}
              </CardTitle>
              
              {compareMode && selectedVersion && (
                <Select
                  value={compareWith || ''}
                  onValueChange={setCompareWith}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Karşılaştırılacak versiyon" />
                  </SelectTrigger>
                  <SelectContent>
                    {versions
                      .filter((v) => v.id !== selectedVersion.id)
                      .map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          v{v.versionNumber} - {v.createdAt.toLocaleDateString('tr-TR')}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          
          <CardContent>
            {compareMode && selectedVersion && compareVersion ? (
              <DiffViewer
                oldVersion={compareVersion.versionNumber < selectedVersion.versionNumber
                  ? compareVersion
                  : selectedVersion}
                newVersion={compareVersion.versionNumber > selectedVersion.versionNumber
                  ? compareVersion
                  : selectedVersion}
              />
            ) : selectedVersion ? (
              <div className="space-y-4">
                {/* Meta bilgiler */}
                <div className="flex flex-wrap gap-4 p-3 bg-gray-50 rounded-lg text-sm">
                  <div>
                    <span className="text-muted-foreground">Versiyon:</span>
                    <Badge className="ml-2">v{selectedVersion.versionNumber}</Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">CTG ID:</span>
                    <Badge variant="outline" className="ml-2 font-mono">
                      {selectedVersion.ctgId}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Oluşturan:</span>
                    <span className="ml-2">{selectedVersion.createdBy}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tarih:</span>
                    <span className="ml-2">
                      {selectedVersion.createdAt.toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {/* Değişiklik notu */}
                <div className="p-3 bg-blue-50 rounded-lg text-sm">
                  <span className="font-medium text-blue-800">Değişiklik Notu:</span>
                  <p className="mt-1 text-blue-700">{selectedVersion.changeNote}</p>
                </div>

                {/* İçerik */}
                <div className="border rounded-lg p-4 font-mono text-sm whitespace-pre-wrap bg-white max-h-[400px] overflow-auto">
                  {selectedVersion.content}
                </div>

                {/* Aksiyonlar */}
                <div className="flex gap-2">
                  {selectedVersion.status !== 'active' && (
                    <Button
                      variant="outline"
                      onClick={() => handleRestoreVersion(selectedVersion)}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Bu Versiyona Geri Dön
                    </Button>
                  )}
                  {selectedVersion.status === 'active' && (
                    <Badge className="bg-green-100 text-green-700 flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Aktif Versiyon
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Bir versiyon seçin
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Yeni Versiyon Dialog */}
      <Dialog open={showNewVersionDialog} onOpenChange={setShowNewVersionDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Yeni Versiyon Oluştur</DialogTitle>
            <DialogDescription>
              Sözleşme içeriğini düzenleyin ve değişiklik notunu ekleyin.
              Yeni versiyon CTG:{' '}
              <span className="font-mono">
                {getNextVersionCTG(versions[versions.length - 1].ctgId)}
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Değişiklik Notu</label>
              <Input
                placeholder="Ne değişti? (örn: Fiyat güncellendi)"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Sözleşme İçeriği</label>
              <Textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="mt-1 min-h-[300px] font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewVersionDialog(false)}>
              İptal
            </Button>
            <Button
              onClick={handleCreateVersion}
              disabled={!newContent.trim() || !changeNote.trim()}
            >
              <Plus className="h-4 w-4 mr-1" />
              Versiyon Oluştur
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Açıklama */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-4">
          <p className="text-sm text-blue-800">
            💡 <strong>CTG Pillar Yapısı:</strong> Her yeni versiyon, öncekinin
            CTG ID'sinin 2 katı olarak kaydedilir (118 → 236 → 472 → ...).
            Bu sayede tüm değişiklik geçmişi matematiksel olarak izlenebilir
            ve doğrulanabilir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContractVersioning;
