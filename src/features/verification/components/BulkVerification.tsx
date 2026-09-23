'use client'

import {
  CSV_TEMPLATE_CONTENT,
  IMatchedConnection,
  checkedW3cAttributes,
  generateNonW3CCredential,
  generateW3CCredential,
  mapCheckedAttributes,
  parseCsvConnectionIds,
} from './BulkVerificationHelpers'
import { JSX, useEffect, useRef, useState } from 'react'
import {
  resetAttributeData,
  resetVerificationState,
} from '@/lib/verificationSlice'
import { useAppDispatch, useAppSelector } from '@/lib/hooks'
import { verifyCredential, verifyCredentialV2 } from '@/app/api/verification'

import { AlertComponent } from '@/components/AlertComponent'
import { AxiosResponse } from 'axios'
import BackButton from '@/components/BackButton'
import { Button } from '@/components/ui/button'
import DataTable from '@/components/DataTable'
import DateTooltip from '@/components/DateTooltip'
import { DidMethod } from '@/common/enums'
import { IConnectionList } from '../type/interface'
import { ITableData } from '@/components/DataTable/interface'
import PageContainer from '@/components/layout/page-container'
import { RequestProofIcon } from '@/components/iconsSvg'
import { RequestType } from '@/features/common/enum'
import { apiStatusCodes } from '@/config/CommonConstant'
import { dateConversion } from '@/utils/DateConversion'
import { getConnectionsByOrg } from '@/app/api/connection'
import { getOrganizationById } from '@/app/api/organization'
import { pathRoutes } from '@/config/pathRoutes'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'

const BulkVerification = (): JSX.Element => {
  const [isW3cDid, setIsW3cDid] = useState<boolean>(false)
  const [fileName, setFileName] = useState<string>('')
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [isValidating, setIsValidating] = useState<boolean>(false)
  const [matchedConnections, setMatchedConnections] = useState<
    IMatchedConnection[]
  >([])
  const [invalidIds, setInvalidIds] = useState<string[]>([])
  const [parseError, setParseError] = useState<string | null>(null)
  const [proofReqSuccess, setProofReqSuccess] = useState<string | null>(null)
  const [errMsg, setErrMsg] = useState<string | null>(null)
  const [requestLoader, setRequestLoader] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const dispatch = useAppDispatch()
  const route = useRouter()
  const orgId = useAppSelector((state) => state.organization.orgId)
  const attributeData = useAppSelector(
    (state) => state.verification.attributeData,
  )

  const selectedConnectionHeader = [
    { columnName: 'User' },
    { columnName: 'Connection ID' },
    { columnName: 'Created on' },
  ]

  const fetchOrganizationDetails = async (): Promise<void> => {
    try {
      if (!orgId) {
        return
      }
      const response = await getOrganizationById(orgId)
      const { data } = response as AxiosResponse
      if (data?.statusCode === apiStatusCodes.API_STATUS_SUCCESS) {
        const did = data?.data?.org_agents?.[0]?.orgDid

        if (did?.includes(DidMethod.POLYGON)) {
          setIsW3cDid(true)
        }
        if (did?.includes(DidMethod.KEY) || did?.includes(DidMethod.WEB)) {
          setIsW3cDid(true)
        }
        if (did?.includes(DidMethod.INDY)) {
          setIsW3cDid(false)
        }
      }
    } catch (error) {
      console.error('Error in fetchOrganizationDetails:', error)
    }
  }

  useEffect(() => {
    fetchOrganizationDetails()
    return (): void => {
      setRequestLoader(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const validateAgainstOrgConnections = async (
    connectionIds: string[],
  ): Promise<void> => {
    setIsValidating(true)
    try {
      const response = await getConnectionsByOrg({
        orgId,
        page: 1,
        itemPerPage: 1000,
        search: '',
        sortBy: 'createDateTime',
        sortingOrder: 'desc',
      })

      const orgConnections: IConnectionList[] =
        (response && typeof response === 'object' && response.data) || []

      const uniqueIds = Array.from(new Set(connectionIds))
      const matched: IMatchedConnection[] = []
      const unmatched: string[] = []

      uniqueIds.forEach((id) => {
        const found = orgConnections.find((conn) => conn.connectionId === id)
        if (found) {
          matched.push({
            connectionId: found.connectionId,
            theirLabel: found.theirLabel || 'Not available',
            createDateTime: found.createDateTime || 'Not available',
          })
        } else {
          unmatched.push(id)
        }
      })

      setMatchedConnections(matched)
      setInvalidIds(unmatched)
    } catch (error) {
      console.error('Error validating connections:', error)
      setParseError('Unable to validate connections. Please try again.')
    } finally {
      setIsValidating(false)
    }
  }

  const handleFile = async (file: File): Promise<void> => {
    setParseError(null)
    setErrMsg(null)
    setProofReqSuccess(null)
    setMatchedConnections([])
    setInvalidIds([])
    setFileName(file.name)

    if (!file.name.toLowerCase().endsWith('.csv')) {
      setParseError('Please upload a valid .csv file.')
      return
    }

    const reader = new FileReader()
    reader.onload = async (event): Promise<void> => {
      const content = (event.target?.result as string) || ''
      const connectionIds = parseCsvConnectionIds(content)

      if (connectionIds.length === 0) {
        setParseError(
          'No connection IDs found in the file. Please use the template below.',
        )
        return
      }

      await validateAgainstOrgConnections(connectionIds)
    }
    reader.onerror = (): void => {
      setParseError('Error reading file. Please try again.')
    }
    reader.readAsText(file)
  }

  const onInputChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) {
      await handleFile(file)
    }
  }

  const onDrop = async (
    event: React.DragEvent<HTMLDivElement>,
  ): Promise<void> => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) {
      await handleFile(file)
    }
  }

  const downloadTemplate = (): void => {
    const blob = new Blob([CSV_TEMPLATE_CONTENT], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'bulk-verification-template.csv'
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  const selectedConnectionList: ITableData[] = matchedConnections.map(
    (conn) => ({
      data: [
        { data: conn.theirLabel },
        { data: conn.connectionId },
        {
          data: (
            <DateTooltip
              date={conn.createDateTime}
              id="bulk_verification_connection_list"
            >
              <div> {dateConversion(conn.createDateTime)} </div>
            </DateTooltip>
          ),
        },
      ],
    }),
  )

  const handleSubmit = async (): Promise<void> => {
    if (matchedConnections.length === 0) {
      return
    }

    setRequestLoader(true)
    try {
      const connectionIds = matchedConnections.map((c) => c.connectionId)
      const checkedAttributes = mapCheckedAttributes(attributeData)
      const checkedW3CAttributes = checkedW3cAttributes(attributeData)

      const verifyCredentialPayload = isW3cDid
        ? generateW3CCredential(connectionIds, checkedW3CAttributes, uuidv4)
        : generateNonW3CCredential(connectionIds, checkedAttributes, orgId)

      const requestType = isW3cDid
        ? RequestType.PRESENTATION_EXCHANGE
        : RequestType.INDY
      let response: null | AxiosResponse | string = null
      if (typeof verifyCredentialPayload.connectionId === 'string') {
        response = await verifyCredential(
          verifyCredentialPayload,
          requestType,
          orgId,
        )
      } else if (Array.isArray(verifyCredentialPayload.connectionId)) {
        response = await verifyCredentialV2(
          verifyCredentialPayload,
          requestType,
          orgId,
        )
      }

      const { data } = response as AxiosResponse
      if (data?.statusCode === apiStatusCodes.API_STATUS_CREATED) {
        dispatch(resetAttributeData())

        setProofReqSuccess(data?.message)
        route.push(`${pathRoutes.organizations.credentials}`)
      } else {
        setErrMsg(response as string)
        setRequestLoader(false)
      }
    } catch (error) {
      console.error('Error occurred during bulk proof request:', error)
      setErrMsg('An error occurred. Please try again.')
      setRequestLoader(false)
    }
    dispatch(resetVerificationState())
  }

  return (
    <PageContainer>
      <div className="px-4 pt-2">
        <div className="col-span-full mb-4 xl:mb-2">
          <div className="flex w-full items-center justify-end">
            <BackButton />
          </div>
        </div>

        <div id="myTabContent">
          {(proofReqSuccess || errMsg || parseError) && (
            <div className="p-2">
              <AlertComponent
                message={proofReqSuccess || errMsg || parseError}
                type={proofReqSuccess ? 'success' : 'failure'}
                onAlertClose={() => {
                  setProofReqSuccess(null)
                  setErrMsg(null)
                  setParseError(null)
                }}
              />
            </div>
          )}

          <div className="mb-4 flex items-center justify-between">
            <h1 className="ml-1 text-xl font-semibold sm:text-2xl">
              Upload connections file
            </h1>
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="flex items-center gap-2"
            >
              Download template
            </Button>
          </div>

          <div
            role="region"
            aria-label="CSV upload dropzone"
            onDrop={onDrop}
            onDragOver={(event) => {
              event.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            className={`flex h-40 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          >
            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
              Drag &amp; drop a .csv file here, or
            </p>
            <label htmlFor="bulk-verification-file">
              <div className="border-input bg-background hover:bg-accent hover:text-accent-foreground cursor-pointer rounded-md border px-4 py-2 shadow-sm">
                Choose file
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                id="bulk-verification-file"
                className="hidden"
                onChange={onInputChange}
              />
            </label>
            {fileName && (
              <p className="mt-2 text-sm text-gray-700 dark:text-white">
                {fileName}
              </p>
            )}
          </div>

          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            The .csv file must contain one connection ID per row under a{' '}
            <span className="font-medium">connectionId</span> column.
          </p>

          {isValidating && (
            <p className="mt-2 text-sm text-gray-500">
              Validating connection IDs&hellip;
            </p>
          )}

          {invalidIds.length > 0 && (
            <div className="mt-4 rounded-lg bg-yellow-50 p-4 text-sm text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
              <p className="mb-1 font-medium">
                {invalidIds.length} connection ID(s) not found for this
                organization and will be skipped:
              </p>
              <p className="break-all">{invalidIds.join(', ')}</p>
            </div>
          )}
        </div>

        <div className="mb-4 flex items-center justify-between pt-3">
          <h1 className="ml-1 text-xl font-semibold sm:text-2xl">
            Selected Users
          </h1>
        </div>
        <div className="pt-2">
          <DataTable
            header={selectedConnectionHeader}
            data={selectedConnectionList}
            loading={false}
          ></DataTable>
          {selectedConnectionList.length > 0 && (
            <div className="flex justify-end pt-3">
              <Button
                onClick={handleSubmit}
                disabled={requestLoader}
                className="mt-2 ml-auto flex items-center gap-2"
              >
                {requestLoader ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-t-transparent" />
                ) : (
                  <RequestProofIcon />
                )}
                Request Proof
              </Button>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}

export default BulkVerification
