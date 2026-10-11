import { createBackendProxy } from '@/utils/proxyApi';

export default createBackendProxy({
  backendPath: '/birds/filter-options',
  methods: ['GET'],
  errorMessage: '获取鸟类筛选选项失败',
  errorCode: 'BIRD_FILTER_OPTIONS_PROXY_FAILED',
});
