const {
  loadProjectsModule,
  loadDemoBundle,
  personalExploreDir,
} = require('../utils/exploreDemoLoader');
const { sendControllerError } = require('../middleware/controllerError');

const listExploreDemoProjects = async (req, res) => {
  try {
    const { source, items } = await loadProjectsModule();
    return res.status(200).json({
      success: true,
      data: {
        source,
        dataRootHint: personalExploreDir(),
        items,
      },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      message: '读取调查项目列表失败',
      code: 'EXPLORE_DEMO_LIST_FAILED',
    });
  }
};

const getExploreDemoProject = async (req, res) => {
  try {
    const pack = await loadDemoBundle(req.params.id);
    if (!pack.ok) {
      return res.status(404).json({
        success: false,
        message: pack.message || '找不到调查项目',
        code: pack.code || 'EXPLORE_DEMO_NOT_FOUND',
        data: { project: pack.project || null },
      });
    }
    return res.status(200).json({
      success: true,
      data: {
        source: pack.source,
        projectsSource: pack.projectsSource,
        project: pack.project,
        demo: pack.demo,
        speciesOrders: pack.speciesOrders,
      },
    });
  } catch (error) {
    return sendControllerError(res, error, {
      message: '读取调查项目失败',
      code: 'EXPLORE_DEMO_GET_FAILED',
    });
  }
};

module.exports = {
  listExploreDemoProjects,
  getExploreDemoProject,
};
