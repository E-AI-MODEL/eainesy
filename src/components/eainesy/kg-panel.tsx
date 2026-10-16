'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Network } from 'lucide-react';
import { useLang } from '@/components/language-provider';

interface KgNode {
  key: string;
  type: string;
  labelNl: string;
  labelEn: string;
  data: { nl?: string; en?: string; detail?: string };
}

interface KgEdge {
  from: string;
  to: string;
  rel: string;
  weight: number;
}

const TYPE_STYLES: Record<string, string> = {
  Emotion: 'bg-rose-100 text-rose-800 border-rose-200',
  Topic: 'bg-amber-100 text-amber-800 border-amber-200',
  Technique: 'bg-blue-100 text-blue-800 border-blue-200',
  Resource: 'bg-cyan-100 text-cyan-800 border-cyan-200',
};

export function KgPanel() {
  const { t, lang } = useLang();
  const [nodes, setNodes] = useState<KgNode[]>([]);
  const [edges, setEdges] = useState<KgEdge[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/kg')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setNodes(data.nodes);
        setEdges(data.edges);
        setCounts(data.counts?.byType ?? {});
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const node = nodes.find((n) => n.key === selected) ?? nodes[0] ?? null;
  const nodeEdges = node ? edges.filter((e) => e.from === node.key || e.to === node.key) : [];

  const typeLabel = (type: string) => (t.kg.types as Record<string, string>)[type] ?? type;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 flex-wrap">
            <Network className="h-4 w-4 text-blue-700" aria-hidden />{t.kg.title}
            <span className="ml-auto flex flex-wrap gap-1.5">
              {Object.entries(counts).map(([type, n]) => (
                <Badge key={type} variant="outline" className={`text-[10px] ${TYPE_STYLES[type] ?? ''}`}>{typeLabel(type)} × {n}</Badge>
              ))}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[56vh] pr-3">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {nodes.map((n) => (
                <button
                  key={n.key}
                  onClick={() => setSelected(n.key)}
                  className={`rounded-lg border p-2.5 text-left transition-colors ${selected === n.key ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                >
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 ${TYPE_STYLES[n.type] ?? ''}`}>{typeLabel(n.type)}</Badge>
                  </div>
                  <p className="mt-1 text-xs font-semibold">{lang === 'nl' ? n.labelNl : n.labelEn}</p>
                  <p className="text-[10px] text-slate-400">{lang === 'nl' ? n.labelEn : n.labelNl}</p>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.kg.nodeDetail}</CardTitle>
        </CardHeader>
        <CardContent>
          {node ? (
            <div className="space-y-3">
              <div>
                <Badge variant="outline" className={`text-[10px] ${TYPE_STYLES[node.type] ?? ''}`}>{typeLabel(node.type)}</Badge>
                <h3 className="mt-2 text-lg font-semibold">
                  {lang === 'nl' ? node.labelNl : node.labelEn}{' '}
                  <span className="text-sm text-slate-400 font-normal">{lang === 'nl' ? node.labelEn : node.labelNl}</span>
                </h3>
                {(node.data.nl || node.data.en) && (
                  <p className="mt-1 text-xs text-slate-600">{lang === 'nl' ? node.data.nl ?? node.data.en : node.data.en ?? node.data.nl}</p>
                )}
              </div>
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">{t.kg.relations} ({nodeEdges.length})</h4>
                <ul className="space-y-1.5">
                  {nodeEdges.map((e, i) => {
                    const other = e.from === node.key ? e.to : e.from;
                    const otherNode = nodes.find((n) => n.key === other);
                    return (
                      <li key={i} className="rounded border border-slate-200 bg-white px-2.5 py-1.5 text-xs flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[9px] font-mono">{e.rel}</Badge>
                        <span className="text-slate-400">{e.from === node.key ? '→' : '←'}</span>
                        <button className="text-blue-700 hover:underline" onClick={() => setSelected(other)}>{otherNode ? (lang === 'nl' ? otherNode.labelNl : otherNode.labelEn) : other}</button>
                      </li>
                    );
                  })}
                  {nodeEdges.length === 0 && <li className="text-xs text-slate-400">{t.kg.noRelations}</li>}
                </ul>
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">{t.kg.footer}</p>
            </div>
          ) : (
            <p className="text-sm text-slate-400">{t.common.loading}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
