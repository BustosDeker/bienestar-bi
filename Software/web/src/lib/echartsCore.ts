import { BarChart, HeatmapChart, LineChart, PieChart, RadarChart, SankeyChart, ScatterChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, RadarComponent, TooltipComponent, VisualMapComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, HeatmapChart, LineChart, RadarChart, SankeyChart, ScatterChart, PieChart, AriaComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, RadarComponent, TooltipComponent, VisualMapComponent, CanvasRenderer]);
export { echarts };
