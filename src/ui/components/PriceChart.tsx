import { useEffect, useRef } from 'react';
import { AreaSeries, createChart } from 'lightweight-charts';
import type { HistoryPoint } from '../../domain/types';

interface PriceChartProps {
  points: HistoryPoint[];
}

export function PriceChart({ points }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      height: 300,
      width: container.clientWidth,
      layout: { attributionLogo: false },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#2563eb',
      topColor: 'rgba(37, 99, 235, 0.3)',
      bottomColor: 'rgba(37, 99, 235, 0)',
    });
    series.setData(points.map((p) => ({ time: p.date, value: p.close })));
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [points]);

  return <div ref={containerRef} className="w-full" />;
}
