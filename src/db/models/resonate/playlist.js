const { Op } = require('sequelize')

module.exports = (sequelize, DataTypes) => {
  const Playlist = sequelize.define('Playlist', {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      validate: {
        isUUID: 4
      },
      unique: true
    },
    cover: {
      type: DataTypes.UUID,
      validate: {
        isUUID: 4
      }
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notNull: {
          msg: 'Title is a required field'
        }
      }
    },
    about: {
      type: DataTypes.TEXT
    },
    private: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    creatorId: {
      type: DataTypes.UUID
    },
    tags: {
      type: DataTypes.TEXT,
      set (tags) {
        if (tags) {
          this.setDataValue('tags', tags.join(','))
        }
      },
      get () {
        const tags = this.getDataValue('tags')
        if (tags) {
          return tags
            .split(',')
            .map(tag => tag
              .trim()
              .toLowerCase()
            ).filter(Boolean)
        }
        return []
      }
    },
    tracks: {
      type: DataTypes.ARRAY(DataTypes.UUID)
    },
    featured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    updatedAt: {
      allowNull: false,
      type: DataTypes.DATE
    },
    createdAt: {
      allowNull: false,
      type: DataTypes.DATE
    },
    deletedAt: {
      type: DataTypes.DATE
    }
  }, {
    sequelize,
    paranoid: true,
    underscored: true,
    modelName: 'Playlist',
    tableName: 'playlists',
    scopes: {
      creator: () => ({
        include: [{
          model: sequelize.models.User,
          required: false,
          attributes: ['id', 'displayName'],
          as: 'creator'
        }]
      }),
      items: (userId) => ({
        // order: [
        //   [{ model: sequelize.models.PlaylistItem, as: 'items' }, 'index', 'asc']
        // ],
        include: [{
          subQuery: false,
          model: sequelize.models.PlaylistItem,
          separate: true,
          attributes: ['id', 'index'],
          order: [['index', 'ASC']],
          as: 'items',
          include: [{
            model: sequelize.models.Track.scope('public', { method: ['loggedIn', userId] }),
            attributes: ['id', 'creatorId', 'title', 'album', 'artist', 'duration', 'status'],
            as: 'track',
            include: [
              {
                model: sequelize.models.File,
                attributes: ['id', 'size', 'ownerId'],
                as: 'audiofile'
              },
              {
                model: sequelize.models.UserGroup,
                as: 'creator',
                attributes: ['displayName', 'id']
              },
              {
                model: sequelize.models.TrackGroupItem,
                as: 'trackOn',
                attributes: ['index'],
                include: [{
                  model: sequelize.models.TrackGroup,
                  as: 'trackGroup',
                  attributes: ['id', 'title', 'cover'],
                  include: [{
                    model: sequelize.models.File,
                    as: 'cover_metadata',
                    attributes: ['id'],
                    required: false,
                    where: {
                      mime: {
                        [Op.in]: ['image/jpeg', 'image/png']
                      }
                    }
                  }]
                }]
              }
            ]
          }
          ]
        }]
      })
    }
  })

  Playlist.associate = function (models) {
    Playlist.hasMany(models.PlaylistItem, { foreignKey: 'playlistId', as: 'items' })
    Playlist.hasOne(models.File, { as: 'cover_metadata', sourceKey: 'cover', foreignKey: 'id' })
    Playlist.hasOne(models.User, { as: 'creator', sourceKey: 'creatorId', foreignKey: 'id' })
  }

  return Playlist
}
