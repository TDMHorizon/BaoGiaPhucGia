const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');

// 1. Make projectWithFile async
code = code.replace(
  /function projectWithFile\(p: ProjectRow\) {/,
  'async function projectWithFile(p: ProjectRow) {'
);
code = code.replace(
  /const fileBase64 = readProjectFile\(p.id\);/,
  'const fileBase64 = await readProjectFile(p.id);'
);

// 2. Wrap app.post, app.get, app.patch, app.delete, app.put with catchAsync if they are not already, and make them async
// Actually it's easier to just do simple string replacements for the specific handlers.

// Route: /api/projects
code = code.replace(
  /app\.post\("\/api\/projects", authMiddleware, \(req, res\) => {/,
  'app.post("/api/projects", authMiddleware, catchAsync(async (req, res) => {'
);
code = code.replace(
  /saveProjectFile\(id, fileBase64\);/,
  'await saveProjectFile(id, fileBase64);'
);
code = code.replace(
  /res\.json\(projectWithFile\(project\)\);/,
  'res.json(await projectWithFile(project));'
);

// Route: /api/projects/:id (GET)
code = code.replace(
  /app\.get\("\/api\/projects\/:id", authMiddleware, \(req, res\) => {/,
  'app.get("/api/projects/:id", authMiddleware, catchAsync(async (req, res) => {'
);

// Route: /api/projects/:id (PATCH)
code = code.replace(
  /app\.patch\("\/api\/projects\/:id", authMiddleware, \(req, res\) => {/,
  'app.patch("/api/projects/:id", authMiddleware, catchAsync(async (req, res) => {'
);
code = code.replace(
  /res\.json\(projectWithFile\(loadProject\(project\.id\)\!\)\);/g,
  'res.json(await projectWithFile(loadProject(project.id)!));'
);

// Route: /api/projects/:id (DELETE)
code = code.replace(
  /app\.delete\("\/api\/projects\/:id", authMiddleware, requireAdminOrManager, \(req, res\) => {/,
  'app.delete("/api/projects/:id", authMiddleware, requireAdminOrManager, catchAsync(async (req, res) => {'
);
code = code.replace(
  /deleteProjectFile\(project\.id\);/,
  'await deleteProjectFile(project.id);'
);

// Route: /api/projects/:id/ranges (PUT)
code = code.replace(
  /app\.put\("\/api\/projects\/:id\/ranges", authMiddleware, requireAdminOrManager, \(req, res\) => {/,
  'app.put("/api/projects/:id/ranges", authMiddleware, requireAdminOrManager, catchAsync(async (req, res) => {'
);

// Route: /api/projects/:id/file (PUT)
code = code.replace(
  /app\.put\("\/api\/projects\/:id\/file", authMiddleware, requireAdminOrManager, \(req, res\) => {/,
  'app.put("/api/projects/:id/file", authMiddleware, requireAdminOrManager, catchAsync(async (req, res) => {'
);

// Route: /api/projects/:id/status (POST)
code = code.replace(
  /app\.post\("\/api\/projects\/:id\/status", authMiddleware, \(req, res\) => {/,
  'app.post("/api/projects/:id/status", authMiddleware, catchAsync(async (req, res) => {'
);

// Route: /api/projects/:id/versions/:version (GET)
code = code.replace(
  /app\.get\("\/api\/projects\/:id\/versions\/:version", authMiddleware, \(req, res\) => {/,
  'app.get("/api/projects/:id/versions/:version", authMiddleware, catchAsync(async (req, res) => {'
);
code = code.replace(
  /const fileBase64 = readVersionSnapshot\(project\.id, version\);/,
  'const fileBase64 = await readVersionSnapshot(project.id, version);'
);

// Route: /api/templates (POST)
code = code.replace(
  /app\.post\("\/api\/templates", authMiddleware, requireAdminOrManager, \(req, res\) => {/,
  'app.post("/api/templates", authMiddleware, requireAdminOrManager, catchAsync(async (req, res) => {'
);
code = code.replace(
  /saveTemplateFile\(id, fileBase64\);/,
  'await saveTemplateFile(id, fileBase64);'
);

// Route: /api/templates/:id/clone (POST)
code = code.replace(
  /app\.post\("\/api\/templates\/:id\/clone", authMiddleware, \(req, res\) => {/,
  'app.post("/api/templates/:id/clone", authMiddleware, catchAsync(async (req, res) => {'
);
code = code.replace(
  /const fileBase64 = readTemplateFile\(template\.id\);/,
  'const fileBase64 = await readTemplateFile(template.id);'
);
code = code.replace(
  /saveProjectFile\(id, fileBase64\);/g, // Might be 2 occurrences if we had one before, but the previous one was replaced with await. Wait, the global g replaces all, so we shouldn't use g unless intended.
  'await saveProjectFile(id, fileBase64);'
);
code = code.replace(
  /res\.json\(projectWithFile\(loadProject\(id\)\!\)\);/,
  'res.json(await projectWithFile(loadProject(id)!));'
);

// Route: /api/templates/:id (DELETE)
code = code.replace(
  /app\.delete\("\/api\/templates\/:id", authMiddleware, requireAdminOrManager, \(req, res\) => {/,
  'app.delete("/api/templates/:id", authMiddleware, requireAdminOrManager, catchAsync(async (req, res) => {'
);
code = code.replace(
  /deleteTemplateFile\(req\.params\.id\);/,
  'await deleteTemplateFile(req.params.id);'
);

// Close the catchAsync for the replaced ones
code = code.replace(
  /  \}\);\n\n  app\.get\("\/api\/projects\/:id",/g,
  '  }));\n\n  app.get("/api/projects/:id",'
);
code = code.replace(
  /  \}\);\n\n  app\.patch\("\/api\/projects\/:id",/g,
  '  }));\n\n  app.patch("/api/projects/:id",'
);
code = code.replace(
  /  \}\);\n\n  app\.delete\("\/api\/projects\/:id",/g,
  '  }));\n\n  app.delete("/api/projects/:id",'
);
code = code.replace(
  /  \}\);\n\n  app\.put\("\/api\/projects\/:id\/ranges",/g,
  '  }));\n\n  app.put("/api/projects/:id/ranges",'
);
code = code.replace(
  /  \}\);\n\n  \/\/ Chỉ admin được cập nhật/g,
  '  }));\n\n  // Chỉ admin được cập nhật'
);
code = code.replace(
  /  \}\);\n\n  \/\/ Status workflow/g,
  '  }));\n\n  // Status workflow'
);
code = code.replace(
  /  \}\);\n\n  \/\/ Versions/g,
  '  }));\n\n  // Versions'
);
code = code.replace(
  /  \}\);\n\n  \/\/ Edits/g,
  '  }));\n\n  // Edits'
);
code = code.replace(
  /  \}\);\n\n  app\.post\("\/api\/templates\/:id\/clone",/g,
  '  }));\n\n  app.post("/api/templates/:id/clone",'
);
code = code.replace(
  /  \}\);\n\n  app\.delete\("\/api\/templates\/:id",/g,
  '  }));\n\n  app.delete("/api/templates/:id",'
);
code = code.replace(
  /  \}\);\n\n  \/\/ Vite \/ static/g,
  '  }));\n\n  // Vite / static'
);


fs.writeFileSync('server.ts', code);
console.log('Done refactoring server.ts for async/await');
