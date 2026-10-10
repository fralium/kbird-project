/**
 * 探索 · 调查项目注册表（公开仓库 stub）
 * 个人项目数据不进 Gitee；本机可从 KBird-Data/personal/exploreDemo 恢复。
 */
const exploreProjects = [];

export function listExploreProjects() {
  return exploreProjects;
}

export function getExploreProject(id) {
  if (!id) return null;
  return exploreProjects.find((p) => p.id === id) || null;
}

export default exploreProjects;
