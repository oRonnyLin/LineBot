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

function calculateAverage (arr, field) {
  let count = 0
  const reducerFuncBase = (acu, cur) => {
    if (!isFinite(cur) || cur === undefined) {
      return acu
    } else {
      count++
      return acu + cur
    }
  }
  const result = arr.reduce((acu, cur) => { return reducerFuncBase(acu, cur[field]) }, 0) / count
  return result
}

function readCSVFile () {
  return new Promise((resolve, reject) => {
    let prevDataBC = null
    let prevDataCA = null
    const resultBC = []
    const resultCA = []
    fs.createReadStream('test.csv')
      .pipe(csv())
      .on('data', (data) => {
        const { pruid, date, prname, numconf, numprob, numtested, numrecover, percentrecover, numtoday, percentoday } = data
        if (pruid === '59' || pruid === '1') { // BC & Canada
          const curData = {
            date: date,
            name: prname,
            numconf: parseInt(numconf) + parseInt(numprob),
            numtested: parseInt(numtested),
            numrecover: parseInt(numrecover),
            percentrecover: parseFloat(percentrecover),
            numtoday: parseInt(numtoday),
            percentoday: parseInt(percentoday)
          }
          if (pruid === '59') {
            if (prevDataBC) {
              curData.newCasesToday = curData.numconf - prevDataBC.numconf
              curData.newRecover = curData.numrecover - prevDataBC.numrecover
              curData.newTested = curData.numtested - prevDataBC.numtested
              curData.percentCase = ((curData.newCasesToday / prevDataBC.numconf) * 100)
              curData.percentRec = ((curData.newRecover / prevDataBC.numrecover) * 100)
              curData.positiveRate = ((curData.newCasesToday / curData.newTested) * 100)
            }
            prevDataBC = curData
            resultBC.push(curData)
          } else if (pruid === '1') {
            if (prevDataCA) {
              curData.newCasesToday = curData.numconf - prevDataCA.numconf
              curData.newRecover = curData.numrecover - prevDataCA.numrecover
              curData.newTested = curData.numtested - prevDataCA.numtested
              curData.percentCase = ((curData.newCasesToday / prevDataCA.numconf) * 100)
              curData.percentRec = ((curData.newRecover / prevDataCA.numrecover) * 100)
              curData.positiveRate = ((curData.newCasesToday / curData.newTested) * 100)
            }
            prevDataCA = curData
            resultCA.push(curData)
          }
        }
      })
      .on('end', () => {
        const data = {
          bc: resultBC[resultBC.length - 1],
          ca: resultCA[resultCA.length - 1]
        }
        // data.bc.avgDailyCases = calculateAverage(resultBC, 'newCasesToday')
        // data.bc.avgDailyRecover = calculateAverage(resultBC, 'newRecover')
        // data.bc.avgTested = calculateAverage(resultBC, 'newTested')
        // data.bc.avgDailyCasePercent = calculateAverage(resultBC, 'percentCase')
        // data.bc.avgDailyRecPercent = calculateAverage(resultBC, 'percentRec')
        data.bc.avgPosRate = calculateAverage(resultBC, 'positiveRate')
        data.bc.avgDailyCaseIncasePercent = calculateAverage(resultBC, 'percentCase')
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
