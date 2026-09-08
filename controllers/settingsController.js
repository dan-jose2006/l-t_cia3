const LibrarySetting = require('../models/LibrarySetting');
const asyncHandler = require('../utils/asyncHandler');

async function getOrCreateSettings() {
  return LibrarySetting.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

const getSettings = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();
  res.json({ success: true, data: settings });
});

const updateSettings = asyncHandler(async (req, res) => {
  const allowed = ['libraryName', 'currency', 'timeZone', 'holdReadyDays', 'allowMemberSelfBorrow', 'allowMemberSelfReturn'];
  const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
  updates.updatedBy = req.user._id;
  const settings = await LibrarySetting.findOneAndUpdate(
    { key: 'default' },
    { $set: updates, $setOnInsert: { key: 'default' } },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
  res.json({ success: true, message: 'Library settings updated', data: settings });
});

module.exports = { getSettings, updateSettings };
