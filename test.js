const bent = require('bent')
const getStreamProvincial = bent('https://health-infobase.canada.ca') // Provincial total confirmed/recovered/deaths
const getStreamRegional = bent('http://www.bccdc.ca')
const csv = require('csv-parser')
const fs = require('fs')
const stream = require('stream')

async function getDataProvincial () {
  const csvfile = await getStreamProvincial('/src/data/covidLive/covid19.csv')
  const buffer = await csvfile.arrayBuffer()
  const readable = stream.Readable()
  readable._read = () => {} // _read is required but you can noop it
  readable.push(buffer)
  readable.push(null)

  readable
    .pipe(csv())
    .on('data', (data) => {
      if (data.pruid === '59') { // BC
        console.log(data)
      }
    })
    .on('end', () => {
      console.log('ended')
    })
}
async function getRegionalCase () {
  const csvFileCase = await getStreamRegional('/Health-Info-Site/Documents/BCCDC_COVID19_Dashboard_Case_Details.csv')
  const buffer = await csvFileCase.arrayBuffer()
  const readable = stream.Readable()
  readable._read = () => {} // _read is required but you can noop it
  readable.push(buffer)
  readable.push(null)
  readable
    .pipe(csv())
    .on('data', (data) => {
      console.log(data)
    })
    .on('end', () => {
      console.log('ended')
    })
}

async function getRegionalLab () {
  const csvFileLab = await getStreamRegional('/Health-Info-Site/Documents/BCCDC_COVID19_Dashboard_Lab_Information.csv')
  const buffer = await csvFileLab.arrayBuffer()
  const readable = stream.Readable()
  readable._read = () => {} // _read is required but you can noop it
  readable.push(buffer)
  readable.push(null)
  readable
    .pipe(csv())
    .on('data', (data) => {
      console.log(data)
    })
    .on('end', () => {
      console.log('ended')
    })
}

async function writeFileProvincial () {
  const csvfile = await getStreamProvincial('/src/data/covidLive/covid19.csv')
  const buffer = await csvfile.arrayBuffer()
  fs.writeFileSync('test.csv', buffer)
  console.log('wrote file')
}

function readCSVFile () {
  return new Promise((resolve, reject) => {
    const result = []
    fs.createReadStream('test.csv')
      .pipe(csv())
      .on('data', (data) => {
        const { pruid, date, prname, numconf, numtested, numrecover, percentrecover, numtoday, percentoday } = data
        if (pruid === '59' || pruid === '1') { // BC & Canada
          console.log(data)
          result.push({
            date: date,
            name: prname,
            numconf: parseInt(numconf),
            numtested: parseInt(numtested),
            numrecover: parseInt(numrecover),
            percentrecover: parseFloat(percentrecover),
            numtoday: parseInt(numtoday),
            percentoday: parseInt(percentoday)
          })
        }
      })
      .on('end', () => {
        const length = result.length
        console.log(result[length - 1].numconf)
        const bcToday = result[length - 2]
        const bcYesterday = result[length - 4]
        const caToday = result[length - 1]
        const caYesterday = result[length - 3]
        const newCasesToday = bcToday.numconf - bcYesterday.numconf
        const newRecover = bcToday.numrecover - bcYesterday.numrecover
        const newTested = bcToday.numtested - bcYesterday.numtested
        const newCasesTodayca = caToday.numconf - caYesterday.numconf
        const newRecoverca = caToday.numrecover - caYesterday.numrecover
        const newTestedca = caToday.numtested - caYesterday.numtested
        const data = {
          bc: {
            newCaseToday: newCasesToday,
            percentIncreaseCase: ((newCasesToday / bcYesterday.numconf) * 100).toFixed(2),
            newRecover: newRecover,
            percentIncraseRec: ((newRecover / bcYesterday.numrecover) * 100).toFixed(2),
            numTested: newTested,
            positiveRate: ((newCasesToday / newTested) * 100).toFixed(2)
          },
          ca: {
            newCaseToday: newCasesTodayca,
            percentIncreaseCase: ((newCasesTodayca / caYesterday.numconf) * 100).toFixed(2),
            newRecover: newRecoverca,
            percentIncraseRec: ((newRecoverca / caYesterday.numrecover) * 100).toFixed(2),
            numTested: newTestedca,
            positiveRate: ((newCasesTodayca / newTestedca) * 100).toFixed(2)
          }
        }
        resolve(data)
      })
  })
}

async function main (run) {
  if (run === 1 || null) {
    await getDataProvincial()
    console.log('Done get data provincial')
  } else if (run === 2 || null) {
    await getRegionalCase()
    console.log('done data regional')
  } else if (run === 3 || null) {
    await getRegionalLab()
  } else if (run === 4 || null) {
    await writeFileProvincial()
    await readCSVFile()
  } else if (run === 5 || null) {
    const result = await readCSVFile()
    return result
  }
}

main(5)
  .then((data) => {
    console.log(data)
  })
