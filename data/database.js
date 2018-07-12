const ScoutUser = require('./models/ScoutUser');
const AudioFileLocation = require('./models/AudioFileLocation');
const Hostname = require('./models/Hostname');
const logger = require('../logger');

class Database {
  async processScoutUser(userid, access_token) {
    try {
      logger.debug(userid);

      const suser = await ScoutUser.get({ pocket_user_id: userid });
      if (suser) {
        logger.debug('Found existing user');
        suser.pocket_access_token = access_token;
        await suser.save();
      } else {
        logger.info(`Creating new user`);
        const newuser = new ScoutUser({
          pocket_user_id: userid,
          pocket_access_token: access_token
        });
        await newuser.save();
      }
    } catch (err) {
      logger.error(`processScoutUser operation failed: ${err}`);
    }
  }

  async getAccessToken(userid) {
    logger.info(`getAccessToken for ${userid}`);
    const user = await ScoutUser.get({ pocket_user_id: userid });
    if (user) {
      logger.debug('Got token: ' + user.pocket_access_token);
      return user.pocket_access_token;
    } else {
      throw 'No user token';
    }
  }

  async getAudioFileLocation(articleId, audioType, speed) {
    logger.info(`getAudioFileLocation for ${articleId}/${audioType}:${speed}`);
    const fileLocation = await AudioFileLocation.get({
      item_id: articleId,
      type: audioType + ':' + speed
    });
    if (fileLocation) {
      return fileLocation.location;
    }
    return '';
  }

  async storeAudioFileLocation(articleId, audioType, speed, location) {
    logger.info(
      `storeAudioFileLocation for ${articleId}/${audioType}:${speed} ` +
        `at ${location}`
    );
    let fileLocation = await AudioFileLocation.get({
      item_id: articleId,
      type: audioType + ':' + speed
    });
    if (!fileLocation) {
      fileLocation = new AudioFileLocation({
        item_id: articleId,
        type: audioType + ':' + speed
      });
    }
    fileLocation.location = location;
    fileLocation.date = Date.now();
    await fileLocation.save();
  }

  async getHostnameData(hostname) {
    logger.info(`getHostnameData for ${hostname}`);
    const data = await Hostname.get({ hostname: hostname });
    return data;
  }

  async storeHostnameData(hostname, faviconUrl, name) {
    logger.info(`storeHostnameData for ${hostname}: ${faviconUrl}, ${name}`);
    let data = await Hostname.get({ hostname: hostname });
    if (!data) {
      data = new Hostname({
        hostname: hostname,
        favicon_url: '',
        favicon_updated_on: 0,
        publisher_name: hostname,
        publisher_updated_on: 0
      });
    }
    if (faviconUrl != '' && faviconUrl != 'error') {
      data.favicon_url = faviconUrl;
      data.favicon_updated_on = Date.now();
    } else if (faviconUrl == 'error') {
      data.favicon_updated_on = Date.now();
    }
    if (name != '' && name != 'error') {
      data.publisher_name = name;
      data.publisher_updated_on = Date.now();
    } else if (name == 'error') {
      data.publisher_updated_on = Date.now();
    }

    await data.save();
    return data;
  }
}

module.exports = Database;
