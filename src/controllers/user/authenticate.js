const { User } = require('../../db/models')
const RedisAdapter = require('../../auth/redis-adapter')

const allowlist = [
  '/collection/apiDocs',
  '/favorites/apiDocs',
  '/plays/apiDocs',
  '/trackgroups/apiDocs',
  '/tracks/apiDocs',
  '/products',
  '/products/checkout',
  '/products/success',
  '/products/apiDocs'
]

const adapter = new RedisAdapter('AccessToken')

const setAccessTokenOnContext = async (ctx) => {
  if (ctx.get('Authorization').startsWith('Bearer ')) {
    // bearer auth
    ctx.accessToken = ctx.get('Authorization').slice(7, ctx.get('Authorization').length).trimLeft()
  } else if (ctx.session.grant && ctx.session.grant.response) {
    // session auth
    ctx.accessToken = ctx.session.grant.response.access_token
  }
}

const findSession = async (ctx) => {
  if (!ctx.accessToken) {
    return null
  }
  const session = await adapter.find(ctx.accessToken)
  if (session?.accountId) {
    const user = await User.findOne({
      where: {
        id: session.accountId
      },
      raw: true
    })

    return user
  }
  return null
}

module.exports.loadProfileIntoContext = async (ctx, next) => {
  await setAccessTokenOnContext(ctx)
  const user = await findSession(ctx)
  if (user) {
    ctx.profile = user
  }
}

module.exports.authenticate = async (ctx, next) => {
  await setAccessTokenOnContext(ctx)

  if (allowlist.includes(ctx.path)) return
  if (!ctx.accessToken) {
    ctx.status = 401
    ctx.throw(401, 'Missing required access token')
  }

  try {
    const user = await findSession(ctx)
    if (user) {
      ctx.profile = user
    } else {
      ctx.status = 401
      ctx.throw(ctx.status, 'User not found')
    }
  } catch (err) {
    console.error(err)
    let message = err.message
    if (err.response) {
      // handle token expiration
      ctx.status = 401
      message = err.response.body.error
    }
    ctx.throw(ctx.status, message)
  }
}
