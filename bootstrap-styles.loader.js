var path = require('path');
var bootstrapPath = require('./bootstrapPath');
var logger = require('./logger');
var glob = require('glob');

function addImportReturnDependency(loader, config, propertyName) {
  var fileNameResolved;
  var fileName = config[propertyName];
  if (fileName && fileName.length > 0) {
    fileNameResolved = path.relative(loader.context, fileName);

    logger.verbose(config, 'fileName for %s: %s', propertyName, fileNameResolved);
    loader.addDependency(fileNameResolved);
    return '@import \'' + fileNameResolved + '\';';
  }
}

module.exports = function(content) {
  var config = this.exec(content, this.resourcePath);
  var pathToBootstrap = bootstrapPath.getPath(this.context);

  var fileNameRegexp = new RegExp(path.join(pathToBootstrap, 'scss', '_(.*)\.scss'));
  var partials = glob.sync(path.join(pathToBootstrap, 'scss', '_*.scss'), {}).map(function(partial) {
    var regexp = path.join(pathToBootstrap, 'scss', '_*.scss');
    return partial.replace(fileNameRegexp, '$1');
  });
  if (!!config.verbose) {
    var unnecessary = Object.keys(config.styles).filter(function(style) {
      return !~partials.indexOf(style);
    });

    if (unnecessary.length) {
      logger.verbose(config, 'unnecessary bootstrap modules:', unnecessary.join(', '));
    }
  }

  var relativePathToBootstrap = path.relative(this.context, pathToBootstrap);
  var start = '';
  this.cacheable(true);
  logger.verbose(config, 'bootstrap location: %s', relativePathToBootstrap);

  var makeImportString = function(relativePathToBootstrap, partial) {
    return '@import \'' + path.join(relativePathToBootstrap, 'scss', partial) + '\';';
  };

  // Prepand minixs
  var mixinPartial = 'mixins';
  if (config.styles[mixinPartial] && !!~partials.indexOf(mixinPartial)) {
    start += makeImportString(relativePathToBootstrap, mixinPartial) + '\n';
  }

  if (config.preBootstrapCustomizations) {
    start += addImportReturnDependency(this, config, 'preBootstrapCustomizations') + '\n';
  }
  start += makeImportString(relativePathToBootstrap, 'variables') + '\n';
  if (config.bootstrapCustomizations) {
    start += addImportReturnDependency(this, config, 'bootstrapCustomizations') + '\n';
  }

  var source = start + partials.filter(function(partial) {
    return config.styles[partial] && !~['variables', mixinPartial].indexOf(partial);
  }).map(function(partial) {
    return makeImportString(relativePathToBootstrap, partial);
  }).join('\n') + '\n';

  if (config.mainSass) {
    source += addImportReturnDependency(this, config, 'mainSass') + '\n';
  }
  source = source.replace(/\\/g, '/');
  logger.debug(config, 'Generated scss file is:\n' + source);

  return source;
};
