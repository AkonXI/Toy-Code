const mocks = {
  '/tpm-bd-screen/v1/queryAllExpertInfo': {
    data: { dataList: [
      { itemName: '指标A', itemNum: '128' },
      { itemName: '指标B', itemNum: '86' },
      { itemName: '指标C', itemNum: '42' },
    ]},
  },
  '/tpm-bd-screen/v1/queryExpertRankingInfo': {
    data: { dataList: [
      { itemName: '人员01', orgName: '部门A', itemNum: '45' },
      { itemName: '人员02', orgName: '部门B', itemNum: '38' },
      { itemName: '人员03', orgName: '部门C', itemNum: '32' },
      { itemName: '人员04', orgName: '部门D', itemNum: '28' },
      { itemName: '人员05', orgName: '部门A', itemNum: '24' },
      { itemName: '人员06', orgName: '部门B', itemNum: '21' },
      { itemName: '人员07', orgName: '部门C', itemNum: '18' },
      { itemName: '人员08', orgName: '部门D', itemNum: '15' },
      { itemName: '人员09', orgName: '部门A', itemNum: '12' },
      { itemName: '人员10', orgName: '部门B', itemNum: '9' },
      { itemName: '人员11', orgName: '部门C', itemNum: '8' },
      { itemName: '人员12', orgName: '部门D', itemNum: '7' },
      { itemName: '人员13', orgName: '部门A', itemNum: '6' },
      { itemName: '人员14', orgName: '部门B', itemNum: '5' },
      { itemName: '人员15', orgName: '部门C', itemNum: '4' },
      { itemName: '人员16', orgName: '部门D', itemNum: '3' },
      { itemName: '人员17', orgName: '部门A', itemNum: '3' },
      { itemName: '人员18', orgName: '部门B', itemNum: '2' },
      { itemName: '人员19', orgName: '部门C', itemNum: '2' },
      { itemName: '人员20', orgName: '部门D', itemNum: '1' },
    ]},
  },
  '/tpm-bd-screen/v1/queryExpertTypeInfo': (params) => {
    const dim = params?.dimension
    let dataList
    if (dim === '3') {
      dataList = [
        { itemName: '类别A', itemNum: '38', percent: '38.0' },
        { itemName: '类别B', itemNum: '62', percent: '62.0' },
      ]
    } else if (dim === '1') {
      dataList = [
        { itemName: '等级一', itemNum: '10', percent: '10.0' },
        { itemName: '等级二', itemNum: '25', percent: '25.0' },
        { itemName: '等级三', itemNum: '35', percent: '35.0' },
        { itemName: '等级四', itemNum: '20', percent: '20.0' },
        { itemName: '等级五', itemNum: '10', percent: '10.0' },
      ]
    } else {
      dataList = [
        { itemName: '领域一', itemNum: '42', percent: '32.8' },
        { itemName: '领域二', itemNum: '28', percent: '21.9' },
        { itemName: '领域三', itemNum: '22', percent: '17.2' },
        { itemName: '领域四', itemNum: '18', percent: '14.1' },
        { itemName: '领域五', itemNum: '10', percent: '7.8' },
        { itemName: '领域六', itemNum: '8', percent: '6.2' },
      ]
    }
    return { data: { dataList } }
  },
  '/tpm-bd-screen/v1/queryExpertDeptInfo': {
    data: { dataList: [
      { orgName: '部门A', itemNum: 45, percent: '25.0' },
      { orgName: '部门B', itemNum: 38, percent: '21.1' },
      { orgName: '部门C', itemNum: 32, percent: '17.8' },
      { orgName: '部门D', itemNum: 28, percent: '15.6' },
      { orgName: '部门E', itemNum: 20, percent: '11.1' },
      { orgName: '部门F', itemNum: 12, percent: '6.7' },
      { orgName: '部门G', itemNum: 5, percent: '2.8' },
    ]},
  },
  '/tpm-warn-record/v1/statisticsWarnRecordCount': {
    data: [
      ['阶段', '级别A', '级别B', '级别C'],
      ['阶段A', 12, 8, 3],
      ['阶段B', 8, 15, 6],
      ['阶段C', 5, 10, 12],
      ['阶段D', 3, 6, 8],
      ['阶段E', 2, 4, 5],
      ['阶段F', 1, 3, 4],
    ],
  },
  '/tpm-warn-record/v1/queryScreenStatisticsByStage': {
    data: [
      { stage: '阶段一', unDealWarnCount: 12, warnCount: 23 },
      { stage: '阶段二', unDealWarnCount: 8, warnCount: 29 },
      { stage: '阶段三', unDealWarnCount: 5, warnCount: 27 },
      { stage: '阶段四', unDealWarnCount: 3, warnCount: 17 },
      { stage: '阶段六', unDealWarnCount: 2, warnCount: 8 },
    ],
  },
  '/tpm-warn-record/v1/statisticsRateByStage': {
    data: [
      { name: '阶段一', value: 52.2, percent: '52.2%' },
      { name: '阶段二', value: 27.6, percent: '27.6%' },
      { name: '阶段三', value: 18.5, percent: '18.5%' },
      { name: '阶段四', value: 17.6, percent: '17.6%' },
      { name: '阶段六', value: 25.0, percent: '25.0%' },
    ],
  },
  '/tpm-warn-record/v1/queryScreenRecordStatistics': {
    data: {
      gaojingCount: 30,
      yujingCount: 46,
      totalCount: 104,
    },
  },
  '/tpm-warn-record/v1/pageQueryInfo': {
    data: {
      data: [
        { warnErrorName: '异常项01', abnormalCause: '原因01:详情已脱敏', sysCompanyName: '公司01', abnormalDate: '2026-05-10', warnType: '1', pkUuid: 'uuid-001' },
        { warnErrorName: '异常项02', abnormalCause: '原因02:详情已脱敏', sysCompanyName: '公司02', abnormalDate: '2026-05-09', warnType: '2', pkUuid: 'uuid-002' },
        { warnErrorName: '异常项03', abnormalCause: '原因03:详情已脱敏', sysCompanyName: '公司03', abnormalDate: '2026-05-08', warnType: '1', pkUuid: 'uuid-003' },
        { warnErrorName: '异常项04', abnormalCause: '原因04:详情已脱敏', sysCompanyName: '公司04', abnormalDate: '2026-05-07', warnType: '2', pkUuid: 'uuid-004' },
        { warnErrorName: '异常项05', abnormalCause: '原因05:详情已脱敏', sysCompanyName: '公司05', abnormalDate: '2026-05-06', warnType: '1', pkUuid: 'uuid-005' },
        { warnErrorName: '异常项06', abnormalCause: '原因06:详情已脱敏', sysCompanyName: '公司06', abnormalDate: '2026-05-05', warnType: '2', pkUuid: 'uuid-006' },
        { warnErrorName: '异常项07', abnormalCause: '原因07:详情已脱敏', sysCompanyName: '公司07', abnormalDate: '2026-05-04', warnType: '1', pkUuid: 'uuid-007' },
        { warnErrorName: '异常项08', abnormalCause: '原因08:详情已脱敏', sysCompanyName: '公司08', abnormalDate: '2026-05-03', warnType: '2', pkUuid: 'uuid-008' },
        { warnErrorName: '异常项09', abnormalCause: '原因09:详情已脱敏', sysCompanyName: '公司09', abnormalDate: '2026-05-02', warnType: '1', pkUuid: 'uuid-009' },
        { warnErrorName: '异常项10', abnormalCause: '原因10:详情已脱敏', sysCompanyName: '公司10', abnormalDate: '2026-05-01', warnType: '2', pkUuid: 'uuid-010' },
        { warnErrorName: '异常项11', abnormalCause: '原因11:详情已脱敏', sysCompanyName: '公司11', abnormalDate: '2026-04-30', warnType: '1', pkUuid: 'uuid-011' },
        { warnErrorName: '异常项12', abnormalCause: '原因12:详情已脱敏', sysCompanyName: '公司12', abnormalDate: '2026-04-28', warnType: '2', pkUuid: 'uuid-012' },
        { warnErrorName: '异常项13', abnormalCause: '原因13:详情已脱敏', sysCompanyName: '公司13', abnormalDate: '2026-04-25', warnType: '1', pkUuid: 'uuid-013' },
        { warnErrorName: '异常项14', abnormalCause: '原因14:详情已脱敏', sysCompanyName: '公司14', abnormalDate: '2026-04-22', warnType: '2', pkUuid: 'uuid-014' },
        { warnErrorName: '异常项15', abnormalCause: '原因15:详情已脱敏', sysCompanyName: '公司15', abnormalDate: '2026-04-20', warnType: '1', pkUuid: 'uuid-015' },
        { warnErrorName: '异常项16', abnormalCause: '原因16:详情已脱敏', sysCompanyName: '公司20', abnormalDate: '2026-04-18', warnType: '2', pkUuid: 'uuid-016' },
        { warnErrorName: '异常项17', abnormalCause: '原因17:详情已脱敏', sysCompanyName: '公司16', abnormalDate: '2026-04-15', warnType: '1', pkUuid: 'uuid-017' },
        { warnErrorName: '异常项18', abnormalCause: '原因18:详情已脱敏', sysCompanyName: '公司17', abnormalDate: '2026-04-12', warnType: '2', pkUuid: 'uuid-018' },
        { warnErrorName: '异常项19', abnormalCause: '原因19:详情已脱敏', sysCompanyName: '公司18', abnormalDate: '2026-04-10', warnType: '1', pkUuid: 'uuid-019' },
        { warnErrorName: '异常项20', abnormalCause: '原因20:详情已脱敏', sysCompanyName: '公司19', abnormalDate: '2026-04-08', warnType: '2', pkUuid: 'uuid-020' },
      ],
    },
  },
  '/tpm-warn-record/v1/statisticsRecordGroupByCompany': {
    data: [
      { title: '公司01', value: 15, trend: 'up', rate: '12.5%' },
      { title: '公司02', value: 12, trend: 'up', rate: '8.3%' },
      { title: '公司03', value: 10, trend: 'down', rate: '-5.2%' },
      { title: '公司04', value: 8, trend: 'up', rate: '3.1%' },
      { title: '公司05', value: 6, trend: 'down', rate: '-2.8%' },
      { title: '公司06', value: 5, trend: 'up', rate: '1.5%' },
      { title: '公司07', value: 7, trend: 'down', rate: '-1.2%' },
      { title: '公司08', value: 9, trend: 'up', rate: '4.7%' },
      { title: '公司09', value: 11, trend: 'up', rate: '6.3%' },
      { title: '公司10', value: 4, trend: 'down', rate: '-3.5%' },
      { title: '公司11', value: 13, trend: 'up', rate: '9.1%' },
      { title: '公司12', value: 3, trend: 'down', rate: '-1.8%' },
      { title: '公司13', value: 14, trend: 'up', rate: '7.2%' },
      { title: '公司14', value: 6, trend: 'up', rate: '2.3%' },
      { title: '公司15', value: 8, trend: 'down', rate: '-4.1%' },
    ],
  },
  '/tpm-act-sectioninfo/v1/statisticsTopProjectCard': {
    data: [
      { title: '指标总数', value: 256, trend: 'up', rate: '12.5%' },
      { title: '状态A', value: 128, trend: 'up', rate: '8.3%' },
      { title: '状态B', value: 98, trend: 'down', rate: '-3.2%' },
      { title: '状态C', value: 30, trend: 'down', rate: '-5.1%' },
    ],
  },
  '/tpm-act-sectioninfo/v1/statisticsProjectStageCnt': {
    data: [
      { name: '阶段零', value: 35 },
      { name: '阶段一', value: 58 },
      { name: '阶段二', value: 42 },
      { name: '阶段三', value: 28 },
      { name: '阶段四', value: 20 },
      { name: '阶段五', value: 15 },
      { name: '阶段六', value: 10 },
    ],
  },
  '/tpm-act-sectioninfo/v1/statisticsAmount': {
    data: {
      xdata: ['1月', '2月', '3月', '4月', '5月', '6月'],
      children: [
        { name: '指标A', data: [120, 200, 150, 80, 70, 110] },
        { name: '指标B', data: [90, 140, 110, 60, 50, 80] },
      ],
    },
  },
  '/tpm-act-sectioninfo/v1/statisticsSignModel': {
    data: [
      { name: '方式一', value: 45 },
      { name: '方式二', value: 28 },
      { name: '方式三', value: 18 },
      { name: '方式四', value: 12 },
      { name: '方式五', value: 8 },
    ],
  },
  '/tpm-act-sectioninfo/v1/statisticsProjectNature': {
    data: [
      { name: '类型一', value: 38 },
      { name: '类型二', value: 25 },
      { name: '类型三', value: 18 },
      { name: '类型四', value: 12 },
      { name: '类型五', value: 7 },
    ],
  },
  '/tpm-act-sectioninfo/v1/statisticsProcurementModel': {
    data: [
      { name: '模式一', value: 55 },
      { name: '模式二', value: 30 },
      { name: '模式三', value: 15 },
    ],
  },
  '/tpm-act-sectioninfo/v1/statisticsProcurementModelDesign': {
    data: [
      { name: '指标一', value: 75, percent: '75%' },
    ],
  },
  '/tpm-act-sectioninfo/v1/statisticsProcurementMethod': {
    data: [
      { name: '方式一', value: 42 },
      { name: '方式二', value: 25 },
      { name: '方式三', value: 15 },
      { name: '方式四', value: 10 },
      { name: '方式五', value: 5 },
      { name: '等级五', value: 3 },
    ],
  },
  '/tpm-act-sectioninfo/v1/statisticsProcurementCategory': {
    data: [
      { name: '类别A', value: 45, children: [
        { name: '子类A1', value: 20 },
        { name: '子类A2', value: 15 },
        { name: '等级五', value: 10 },
      ]},
      { name: '类别B', value: 30, children: [
        { name: '子类B1', value: 12 },
        { name: '子类B2', value: 10 },
        { name: '子类B3', value: 8 },
      ]},
      { name: '类别C', value: 25, children: [
        { name: '子类C1', value: 10 },
        { name: '子类C2', value: 8 },
        { name: '子类C3', value: 7 },
      ]},
    ],
  },
  '/tpm-bd-screen/v1/queryInfoSupplierRight': {
    data: { dataList: [
      { itemName: '类型A', itemNum: 85, percent: '42.5' },
      { itemName: '类型B', itemNum: 55, percent: '27.5' },
      { itemName: '类型C', itemNum: 35, percent: '17.5' },
      { itemName: '类型D', itemNum: 25, percent: '12.5' },
    ]},
  },
  '/tpm-bd-screen/v1/queryInfoRightBottom': {
    data: { dataList: [
      { itemName: '等级A', itemNum: 28, percent: '28.0' },
      { itemName: '等级B', itemNum: 35, percent: '35.0' },
      { itemName: '等级C', itemNum: 22, percent: '22.0' },
      { itemName: '等级D', itemNum: 15, percent: '15.0' },
    ]},
  },
  '/tpm-bd-screen/v1/queryInfoLeftUp': {
    data: { dataList: [
      { itemName: '类别A', itemNum: 120 },
      { itemName: '类别B', itemNum: 85 },
      { itemName: '类别C', itemNum: 55 },
    ]},
  },
  '/tpm-bd-screen/v1/querySupplierInfoLeftBottom': {
    data: { dataList: [
      { itemName: '地区01', itemNum: 48 },
      { itemName: '地区02', itemNum: 35 },
      { itemName: '地区03', itemNum: 28 },
      { itemName: '地区04', itemNum: 22 },
      { itemName: '地区05', itemNum: 18 },
      { itemName: '地区06', itemNum: 12 },
      { itemName: '地区07', itemNum: 8 },
    ]},
  },
  '/tpm-bd-screen/v1/queryTenderagentInfoLeftBottom': {
    data: { dataList: [
      { itemName: '等级A', itemNum: 15 },
      { itemName: '等级B', itemNum: 25 },
      { itemName: '等级C', itemNum: 12 },
    ]},
  },
  '/tpm-bd-screen/v1/queryInfoMiddleUp': (params) => {
    const tt = params?.timeType
    let dataList
    if (tt === '1') {
      dataList = [
        { itemName: '2022-06-01', itemNum: 18 },
        { itemName: '2023-06-01', itemNum: 25 },
        { itemName: '2024-06-01', itemNum: 32 },
        { itemName: '2025-06-01', itemNum: 28 },
        { itemName: '2026-06-01', itemNum: 40 },
      ]
    } else if (tt === '2') {
      dataList = [
        { itemName: '2026-01-15', itemNum: 22 },
        { itemName: '2026-04-15', itemNum: 35 },
        { itemName: '2026-07-15', itemNum: 28 },
        { itemName: '2026-10-15', itemNum: 18 },
      ]
    } else {
      dataList = [
        { itemName: '2026-01-01', itemNum: 25 },
        { itemName: '2026-02-01', itemNum: 32 },
        { itemName: '2026-03-01', itemNum: 28 },
        { itemName: '2026-04-01', itemNum: 35 },
        { itemName: '2026-05-01', itemNum: 40 },
        { itemName: '2026-06-01', itemNum: 30 },
      ]
    }
    return { data: { dataList } }
  },
  '/tpm-bd-screen/v1/queryInfoMiddleDown': {
    data: { dataList: [
      { itemName: '模式A', itemNum: 65, percent: '43.3' },
      { itemName: '模式B', itemNum: 45, percent: '30.0' },
    ]},
  },
  '/tpm-bd-screen/v1/queryInfoCenter': {
    data: { dataList: [
      { itemName: '2026-Q1', itemNum: 85 },
      { itemName: '2026-Q2', itemNum: 102 },
      { itemName: '2026-Q3', itemNum: 78 },
      { itemName: '2026-Q4', itemNum: 55 },
    ]},
  },
  '/tpm-open-openaudit/v1/queryList': {
    data: {
      data: [
        { openTitle: '项目公告001', abnormalCause: '', sendInfoFromName: '部门D', sendTime: '2026-05-15T10:00:00', pkUuid: 'uuid-101' },
        { openTitle: '项目公告002', abnormalCause: '', sendInfoFromName: '部门I', sendTime: '2026-05-14T14:30:00', pkUuid: 'uuid-102' },
        { openTitle: '项目公告003', abnormalCause: '', sendInfoFromName: '部门H', sendTime: '2026-05-13T09:00:00', pkUuid: 'uuid-103' },
        { openTitle: '项目公告004', abnormalCause: '', sendInfoFromName: '部门D', sendTime: '2026-05-12T16:00:00', pkUuid: 'uuid-104' },
        { openTitle: '项目公告005', abnormalCause: '', sendInfoFromName: '部门I', sendTime: '2026-05-11T11:00:00', pkUuid: 'uuid-105' },
      ],
    },
  },
  '/org/v1/hasSubCompanies': { data: false },
  '/org/v1/queryOrgNodeTreeByAttrWithAuth': { data: [
    { nodeId: 'root', nodeName: '部门总公司', children: [
      { nodeId: 'dept1', nodeName: '部门D' },
      { nodeId: 'dept2', nodeName: '部门A' },
      { nodeId: 'dept3', nodeName: '部门E' },
    ]},
  ]},
  default: { data: { dataList: [] } },
}

export default mocks
