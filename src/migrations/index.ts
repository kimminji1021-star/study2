import * as migration_20261117_083422_initial from './20261117_083422_initial'

export const migrations = [
  {
    up: migration_20261117_083422_initial.up,
    down: migration_20261117_083422_initial.down,
    name: '20261117_083422_initial',
  },
]
