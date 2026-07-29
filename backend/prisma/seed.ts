import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { PrismaClient, SslMode, UserStatus, UserType } from '@prisma/client'
import { encrypt } from '../src/datasources/crypto.js'
import { MODULES, actionsForModule } from '../src/auth/permissions.js'

const prisma = new PrismaClient()

function parseDatabaseUrl(url: string) {
  const parsed = new URL(url)
  const database = parsed.pathname.replace(/^\//, '').split('?')[0]
  if (!database) {
    throw new Error('DATABASE_URL is missing a database name')
  }
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 5432,
    database,
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  }
}

function sslModeForHost(host: string): SslMode {
  return host === 'localhost' || host === '127.0.0.1' ? SslMode.DISABLE : SslMode.REQUIRE
}

async function main() {
  // Remove legacy permission keys from prior seed
  await prisma.rolePermission.deleteMany({
    where: {
      permission: {
        actionKey: { in: ['create', 'update', 'approve'] },
      },
    },
  })
  await prisma.permission.deleteMany({
    where: {
      actionKey: { in: ['create', 'update', 'approve'] },
    },
  })

  await prisma.rolePermission.deleteMany({
    where: { permission: { moduleKey: 'access' } },
  })
  await prisma.permission.deleteMany({
    where: { moduleKey: 'access' },
  })

  await prisma.rolePermission.deleteMany({
    where: {
      permission: { moduleKey: { in: ['system-config', 'access'] } },
    },
  })
  await prisma.permission.deleteMany({
    where: { moduleKey: { in: ['system-config', 'access'] } },
  })

  for (const moduleKey of MODULES) {
    const allowed = actionsForModule(moduleKey)
    await prisma.rolePermission.deleteMany({
      where: {
        permission: {
          moduleKey,
          actionKey: { notIn: [...allowed] },
        },
      },
    })
    await prisma.permission.deleteMany({
      where: {
        moduleKey,
        actionKey: { notIn: [...allowed] },
      },
    })
  }

  for (const moduleKey of MODULES) {
    for (const actionKey of actionsForModule(moduleKey)) {
      await prisma.permission.upsert({
        where: { moduleKey_actionKey: { moduleKey, actionKey } },
        update: {
          name: `${moduleKey}:${actionKey}`,
          description: `${actionKey} permission for ${moduleKey}`,
        },
        create: {
          moduleKey,
          actionKey,
          name: `${moduleKey}:${actionKey}`,
          description: `${actionKey} permission for ${moduleKey}`,
        },
      })
    }
  }

  const ownerRole = await prisma.role.upsert({
    where: { name: 'Owner' },
    update: {},
    create: { name: 'Owner', description: 'Full system access' },
  })

  const allPermissions = await prisma.permission.findMany({ select: { id: true } })
  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: ownerRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: ownerRole.id, permissionId: permission.id },
    })
  }

  const username = process.env.OWNER_USERNAME ?? 'owner'
  const email = process.env.OWNER_EMAIL ?? 'owner@bi.local'
  const password = process.env.OWNER_PASSWORD ?? 'ChangeMeNow123!'
  const passwordHash = await bcrypt.hash(password, 12)

  let organization = await prisma.organization.findFirst({
    where: { isDefault: true },
    orderBy: { createdAt: 'asc' },
  })

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: process.env.DEFAULT_ORG_NAME ?? 'Default Organization',
        slug: process.env.DEFAULT_ORG_SLUG ?? 'default',
        isDefault: true,
        billingOwnerEmail: email.toLowerCase(),
        billingOwnerName: username,
      },
    })
  }

  const owner = await prisma.user.upsert({
    where: { email },
    update: {
      username,
      passwordHash,
      userType: UserType.OWNER,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
      organizationId: organization.id,
    },
    create: {
      username,
      email,
      passwordHash,
      userType: UserType.OWNER,
      status: UserStatus.ACTIVE,
      mustChangePassword: false,
      organizationId: organization.id,
    },
  })

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: owner.id, roleId: ownerRole.id } },
    update: {},
    create: { userId: owner.id, roleId: ownerRole.id },
  })

  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    try {
      const conn = parseDatabaseUrl(databaseUrl)
      await prisma.dataSource.upsert({
        where: {
          organizationId_name: {
            organizationId: organization.id,
            name: 'APS Wallet (Local)',
          },
        },
        update: {
          host: conn.host,
          port: conn.port,
          database: conn.database,
          username: conn.username,
          passwordEncrypted: encrypt(conn.password),
          sslMode: sslModeForHost(conn.host),
          isActive: true,
        },
        create: {
          name: 'APS Wallet (Local)',
          organizationId: organization.id,
          host: conn.host,
          port: conn.port,
          database: conn.database,
          username: conn.username,
          passwordEncrypted: encrypt(conn.password),
          sslMode: sslModeForHost(conn.host),
          isActive: true,
          createdById: owner.id,
        },
      })
    } catch (error) {
      console.warn(
        'Skipped default data source seed:',
        error instanceof Error ? error.message : error,
      )
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
