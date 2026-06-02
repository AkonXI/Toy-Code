import * as echarts from 'echarts/core'

// 引入你需要的 ECharts 模块
import {
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  ToolboxComponent,
  DatasetComponent,
  GraphicComponent
} from 'echarts/components'

import { LineChart, BarChart, PieChart, CustomChart, GaugeChart } from 'echarts/charts'
import { CanvasRenderer } from 'echarts/renderers'

// 使用引入的模块
echarts.use([
  TitleComponent,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  ToolboxComponent,
  DatasetComponent,
  LineChart,
  BarChart,
  PieChart,
  CanvasRenderer,
  CustomChart,
  GraphicComponent,
  GaugeChart
])

export default echarts
