function collectGotosFromValue(value, path, acc) {
    if (value === null || typeof value !== 'object') {
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item, index) => {
            collectGotosFromValue(item, `${path}[${index}]`, acc);
        });

        return;
    }

    if (Object.prototype.hasOwnProperty.call(value, 'goto')) {
        const target = value.goto;

        if (target !== undefined && target !== null) {
            acc.push({
                target,
                path: `${path}.goto`,
            });
        }
    }

    for (const [key, nestedValue] of Object.entries(value)) {
        if (key === 'goto') {
            continue;
        }

        collectGotosFromValue(nestedValue, `${path}.${key}`, acc);
    }
}

export function validateProjectScenes(scenes) {
    const safeScenes = Array.isArray(scenes) ? scenes : [];

    const nodeIds = new Set();
    const gotoLinks = [];

    safeScenes.forEach((scene, sceneIndex) => {
        const nodes = scene?.nodes ?? [];

        nodes.forEach((node, nodeIndex) => {
            if (node?.id !== undefined && node?.id !== null) {
                nodeIds.add(node.id);
            }

            const basePath = `scenes[${sceneIndex}].nodes[${nodeIndex}]`;

            collectGotosFromValue(node, basePath, gotoLinks);
        });
    });

    const errors = [];

    for (const link of gotoLinks) {
        if (!nodeIds.has(link.target)) {
            errors.push({
                target: link.target,
                path: link.path,
                message: `goto "${link.target}" не ведёт на существующий узел`,
            });
        }
    }

    return {
        valid: errors.length === 0,
        hasGoto: gotoLinks.length > 0,
        gotoCount: gotoLinks.length,
        nodeCount: nodeIds.size,
        errors,
    };
}