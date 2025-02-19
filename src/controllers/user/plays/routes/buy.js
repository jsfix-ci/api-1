const { Play, Track, Credit } = require('../../../../db/models')
const { Op } = require('sequelize')
const { calculateRemainingCost, formatCredit } = require('@resonate/utils')
const numbro = require('numbro')
const { authenticate } = require('../../authenticate')

const subtract = (a, b) => numbro(a).subtract(b).value()

module.exports = function () {
  const operations = {
    POST: [authenticate, POST]
  }

  async function POST (ctx, next) {
    const { trackId } = ctx.request.body

    try {
      const track = await Track.findOne({
        where: {
          id: trackId,
          status: {
            [Op.in]: [0, 2, 3]
          }
        }
      })

      if (!track) {
        ctx.status = 404
        ctx.throw(ctx.status, 'Track does not exist or is unavailable')
      }

      const wallet = await Credit.findOne({
        where: {
          userId: ctx.profile.id
        }
      })

      if (!wallet) {
        ctx.status = 404
        ctx.throw(ctx.status, 'Wallet does not exist')
      }

      const currentCount = await Play.count({
        where: {
          trackId,
          userId: ctx.profile.id,
          event: 1
        }
      })

      let cost = 0
      let newCount = currentCount
      const maxCount = 9

      if (track.get('status') !== 'free' && currentCount < maxCount) {
        cost = calculateRemainingCost(currentCount)
      }

      const plays = []

      // current count starts at 0
      for (let i = currentCount; i < maxCount; i = i + 1) {
        plays.push(i)
      }

      let result

      if (cost > 0 && wallet.total >= cost) {
        result = await Promise.all(plays.map(async (count) => {
          // TODO save the final play count
          return Play.create({
            // count: count + 1,
            trackId: track.id,
            userId: ctx.profile.id,
            createdAt: new Date(),
            type: 'paid'
          })
        }))

        wallet.total = subtract(wallet.total, cost)

        newCount = maxCount

        await wallet.save()
      }

      ctx.body = {
        data: {
          result,
          count: newCount,
          cost: cost,
          total: formatCredit(wallet.total)
        }
      }
    } catch (err) {
      ctx.throw(ctx.status, err.message)
    }

    await next()
  }

  POST.apiDoc = {
    operationId: 'buyPlays',
    description: 'Buy plays',
    tags: ['plays'],
    parameters: [
      {
        in: 'body',
        name: 'play',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['trackId'],
          properties: {
            trackId: {
              type: 'string',
              format: 'uuid'
            }
          }
        }
      }
    ],
    responses: {
      200: {
        description: 'The play data',
        schema: {
          type: 'object'
        }
      },
      404: {
        description: 'No play data found.'
      },
      default: {
        description: 'Unexpected error',
        schema: {
          $ref: '#/definitions/Error'
        }
      }
    }
  }

  return operations
}
