import { loadConfig, loadLocalEnvironment } from './src/config.js'
import { createOrmOptions } from './src/database.js'

loadLocalEnvironment()

export default createOrmOptions(loadConfig())
