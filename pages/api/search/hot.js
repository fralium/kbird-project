import { createBackendProxy } from '@/utils/proxyApi';

export default createBackendProxy({
  backendPath: '/search/hot',
  methods: ['GET'],
  errorMessage: '热门搜索暂不可用',
  errorCode: 'SEARCH_HOT_PROXY_FAILED',
});
