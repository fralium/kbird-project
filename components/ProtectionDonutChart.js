'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as echarts from 'echarts';

/**
 * 圆角分段环形图：间隙 + 外侧百分比引线 + 底部图例。
 * 用于中国保护等级 / IUCN 受胁等级。
 */
export default function ProtectionDonutChart({
  breakdown = [],
  colorMap = {},
  emptyTip = '暂无已关联鸟种数据',
  className = '',
}) {
  const hostRef = useRef(null);
  const chartRef = useRef(null);

  const seriesData = useMemo(() => {
    return (Array.isArray(breakdown) ? breakdown : [])
      .filter((row) => Number(row?.count) > 0)
      .map((row) => ({
        name: String(row.level || '未知'),
        value: Number(row.count) || 0,
        itemStyle: {
          color: colorMap[row.level] || '#94a3b8',
        },
      }));
  }, [breakdown, colorMap]);

  const total = useMemo(
    () => seriesData.reduce((sum, row) => sum + row.value, 0),
    [seriesData]
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const chart = echarts.init(host, null, { renderer: 'canvas' });
    chartRef.current = chart;

    const onResize = () => {
      if (chart.isDisposed?.()) return;
      chart.resize();
    };
    window.addEventListener('resize', onResize);
    let ro;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onResize);
      ro.observe(host);
    }

    return () => {
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || chart.isDisposed?.()) return;

    if (!seriesData.length || total <= 0) {
      chart.setOption(
        {
          title: {
            show: true,
            text: emptyTip,
            left: 'center',
            top: 'middle',
            textStyle: {
              color: '#94a3b8',
              fontSize: 13,
              fontWeight: 500,
            },
          },
          tooltip: { show: false },
          legend: { show: false },
          series: [],
        },
        { notMerge: true, lazyUpdate: true }
      );
      return;
    }

    chart.setOption(
      {
        title: { show: false },
        animationDuration: 420,
        tooltip: {
          show: true,
          trigger: 'item',
          borderWidth: 0,
          backgroundColor: 'rgba(15, 23, 32, 0.88)',
          textStyle: { color: '#fff', fontSize: 12 },
          formatter: (params) => {
            const pct = params?.percent != null ? Number(params.percent).toFixed(2) : '0';
            return `${params.name}<br/>${params.value} 种 · ${pct}%`;
          },
        },
        legend: {
          show: true,
          type: 'scroll',
          orient: 'horizontal',
          bottom: 2,
          left: 'center',
          itemWidth: 12,
          itemHeight: 8,
          itemGap: 14,
          icon: 'roundRect',
          textStyle: {
            color: '#334155',
            fontSize: 12,
          },
          pageIconSize: 10,
          pageTextStyle: { color: '#64748b' },
        },
        series: [
          {
            id: 'protection-donut',
            type: 'pie',
            radius: ['46%', '68%'],
            center: ['50%', '46%'],
            padAngle: 5,
            minAngle: 4,
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: 12,
              borderColor: '#ffffff',
              borderWidth: 3,
              shadowBlur: 10,
              shadowColor: 'rgba(84, 112, 198, 0.18)',
            },
            label: {
              show: true,
              formatter: (params) => `${Number(params.percent).toFixed(2)}%`,
              color: '#475569',
              fontSize: 12,
              fontWeight: 600,
            },
            labelLine: {
              show: true,
              length: 14,
              length2: 10,
              smooth: 0.2,
              lineStyle: {
                width: 1.2,
              },
            },
            emphasis: {
              scale: true,
              scaleSize: 4,
              itemStyle: {
                shadowBlur: 14,
                shadowColor: 'rgba(2, 48, 71, 0.18)',
              },
            },
            data: seriesData,
          },
        ],
      },
      { notMerge: true, lazyUpdate: true }
    );
  }, [seriesData, total, emptyTip]);

  return <div ref={hostRef} className={className} role="img" aria-label="保护等级环形图" />;
}
