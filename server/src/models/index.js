// require('./models') loads every model so Mongoose registers them all
module.exports = {
  User: require('./User'),
  EmailVerificationCode: require('./EmailVerificationCode'),
  Ngo: require('./Ngo'),
  Disaster: require('./Disaster'),
  DisasterCommitment: require('./DisasterCommitment'),
  SiteAssessment: require('./SiteAssessment'),
  Camp: require('./Camp'),
  CampNgo: require('./CampNgo'),
  ShortageOffer: require('./ShortageOffer'),
  Request: require('./Request'),
  Notification: require('./Notification'),
};
