const { Resonate: sequelize, Track } = require('../../../../../db/models')
const trackService = require('../../../../tracks/services/trackService')

module.exports = function () {
  const operations = {
    GET,
    parameters: [
      {
        name: 'id',
        in: 'path',
        type: 'string',
        required: true,
        description: 'Artist id.',
        format: 'uuid'
      }
    ]
  }

  async function GET (ctx, next) {
    if (await ctx.cashed?.()) return

    const { limit = 50, page = 1 } = ctx.request.query

    const offset = page > 1 ? (page - 1) * limit : 0

    try {
      const result = await sequelize.query(`
        SELECT track.track_name, track.track_album, track.tid, track.track_duration, track.track_cover_art as cover_art, track.status, track.uid, um.meta_value as artist, cover.id as cover
        FROM tracks as track
        LEFT JOIN files as cover ON(cover.id = track.track_url)
        WHERE uid = :creatorId
        AND track.status IN (0, 2, 3)
        AND track.track_album != ''
        AND track.track_cover_art != ''
        ORDER BY track.tid
        LIMIT :limit
        OFFSET :offset
      `, {
        type: sequelize.QueryTypes.SELECT,
        replacements: {
          creatorId: ctx.params.id,
          offset,
          limit
        },
        mapToModel: true,
        model: Track
      })

      ctx.body = {
        data: trackService(ctx).list(result)
      }
    } catch (err) {
      ctx.throw(ctx.status, err.message)
    }

    await next()
  }

  GET.apiDoc = {
    operationId: 'getArtistTracks',
    description: 'Returns all artist tracks',
    summary: 'Find artist tracks',
    tags: ['artists'],
    produces: [
      'application/json'
    ],
    responses: {
      400: {
        description: 'Bad request',
        schema: {
          $ref: '#/responses/BadRequest'
        }
      },
      404: {
        description: 'Not found',
        schema: {
          $ref: '#/responses/NotFound'
        }
      },
      default: {
        description: 'error payload',
        schema: {
          $ref: '#/definitions/Error'
        }
      }
    },
    parameters: [
      {
        description: 'The maximum number of results to return',
        in: 'query',
        name: 'limit',
        type: 'integer',
        maximum: 100
      },
      {
        type: 'integer',
        description: 'The current page',
        in: 'query',
        name: 'page',
        minimum: 1
      }
    ]
  }

  return operations
}
