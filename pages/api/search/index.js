import { createBackendProxy } from '@/utils/proxyApi';

export default createBackendProxy({
  backendPath: '/search',
  methods: ['GET'],
  errorMessage: '搜索暂不可用',
  errorCode: 'SEARCH_PROXY_FAILED',
});
