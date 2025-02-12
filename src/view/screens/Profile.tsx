import React, {useMemo} from 'react'
import {StyleSheet} from 'react-native'
import {
  AppBskyActorDefs,
  moderateProfile,
  ModerationOpts,
  RichText as RichTextAPI,
} from '@atproto/api'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {useFocusEffect} from '@react-navigation/native'
import {useQueryClient} from '@tanstack/react-query'

import {cleanError} from '#/lib/strings/errors'
import {useProfileShadow} from '#/state/cache/profile-shadow'
import {useLabelerInfoQuery} from '#/state/queries/labeler'
import {resetProfilePostsQueries} from '#/state/queries/post-feed'
import {useModerationOpts} from '#/state/queries/preferences'
import {useProfileQuery} from '#/state/queries/profile'
import {useResolveDidQuery} from '#/state/queries/resolve-uri'
import {getAgent, useSession} from '#/state/session'
import {useSetDrawerSwipeDisabled, useSetMinimalShellMode} from '#/state/shell'
import {useComposerControls} from '#/state/shell/composer'
import {useAnalytics} from 'lib/analytics/analytics'
import {useSetTitle} from 'lib/hooks/useSetTitle'
import {ComposeIcon2} from 'lib/icons'
import {CommonNavigatorParams, NativeStackScreenProps} from 'lib/routes/types'
import {useGate} from 'lib/statsig/statsig'
import {combinedDisplayName} from 'lib/strings/display-names'
import {isInvalidHandle} from 'lib/strings/handles'
import {colors, s} from 'lib/styles'
import {listenSoftReset} from 'state/events'
import {PagerWithHeader} from 'view/com/pager/PagerWithHeader'
import {ProfileHeader, ProfileHeaderLoading} from '#/screens/Profile/Header'
import {ProfileFeedSection} from '#/screens/Profile/Sections/Feed'
import {ProfileLabelsSection} from '#/screens/Profile/Sections/Labels'
import {ScreenHider} from '#/components/moderation/ScreenHider'
import {ExpoScrollForwarderView} from '../../../modules/expo-scroll-forwarder'
import {ProfileFeedgens} from '../com/feeds/ProfileFeedgens'
import {ProfileLists} from '../com/lists/ProfileLists'
import {ErrorScreen} from '../com/util/error/ErrorScreen'
import {FAB} from '../com/util/fab/FAB'
import {ListRef} from '../com/util/List'
import {CenteredView} from '../com/util/Views'

interface SectionRef {
  scrollToTop: () => void
}

type Props = NativeStackScreenProps<CommonNavigatorParams, 'Profile'>
export function ProfileScreen({route}: Props) {
  const {_} = useLingui()
  const {currentAccount} = useSession()
  const queryClient = useQueryClient()
  const name =
    route.params.name === 'me' ? currentAccount?.did : route.params.name
  const moderationOpts = useModerationOpts()
  const {
    data: resolvedDid,
    error: resolveError,
    refetch: refetchDid,
    isLoading: isLoadingDid,
  } = useResolveDidQuery(name)
  const {
    data: profile,
    error: profileError,
    refetch: refetchProfile,
    isLoading: isLoadingProfile,
    isPlaceholderData: isPlaceholderProfile,
  } = useProfileQuery({
    did: resolvedDid,
  })

  const onPressTryAgain = React.useCallback(() => {
    if (resolveError) {
      refetchDid()
    } else {
      refetchProfile()
    }
  }, [resolveError, refetchDid, refetchProfile])

  // When we open the profile, we want to reset the posts query if we are blocked.
  React.useEffect(() => {
    if (resolvedDid && profile?.viewer?.blockedBy) {
      resetProfilePostsQueries(queryClient, resolvedDid)
    }
  }, [queryClient, profile?.viewer?.blockedBy, resolvedDid])

  // Most pushes will happen here, since we will have only placeholder data
  if (isLoadingDid || isLoadingProfile) {
    return (
      <CenteredView>
        <ProfileHeaderLoading />
      </CenteredView>
    )
  }
  if (resolveError || profileError) {
    return (
      <ErrorScreen
        testID="profileErrorScreen"
        title={profileError ? _(msg`Not Found`) : _(msg`Oops!`)}
        message={cleanError(resolveError || profileError)}
        onPressTryAgain={onPressTryAgain}
        showHeader
      />
    )
  }
  if (profile && moderationOpts) {
    return (
      <ProfileScreenLoaded
        profile={profile}
        moderationOpts={moderationOpts}
        isPlaceholderProfile={isPlaceholderProfile}
        hideBackButton={!!route.params.hideBackButton}
      />
    )
  }
  // should never happen
  return (
    <ErrorScreen
      testID="profileErrorScreen"
      title="Oops!"
      message="Something went wrong and we're not sure what."
      onPressTryAgain={onPressTryAgain}
      showHeader
    />
  )
}

function ProfileScreenLoaded({
  profile: profileUnshadowed,
  isPlaceholderProfile,
  moderationOpts,
  hideBackButton,
}: {
  profile: AppBskyActorDefs.ProfileViewDetailed
  moderationOpts: ModerationOpts
  hideBackButton: boolean
  isPlaceholderProfile: boolean
}) {
  const profile = useProfileShadow(profileUnshadowed)
  const {hasSession, currentAccount} = useSession()
  const setMinimalShellMode = useSetMinimalShellMode()
  const {openComposer} = useComposerControls()
  const {screen, track} = useAnalytics()
  const shouldUseScrollableHeader = useGate('new_profile_scroll_component')
  const {
    data: labelerInfo,
    error: labelerError,
    isLoading: isLabelerLoading,
  } = useLabelerInfoQuery({
    did: profile.did,
    enabled: !!profile.associated?.labeler,
  })
  const [currentPage, setCurrentPage] = React.useState(0)
  const {_} = useLingui()
  const setDrawerSwipeDisabled = useSetDrawerSwipeDisabled()

  const [scrollViewTag, setScrollViewTag] = React.useState<number | null>(null)

  const postsSectionRef = React.useRef<SectionRef>(null)
  const repliesSectionRef = React.useRef<SectionRef>(null)
  const mediaSectionRef = React.useRef<SectionRef>(null)
  const likesSectionRef = React.useRef<SectionRef>(null)
  const feedsSectionRef = React.useRef<SectionRef>(null)
  const listsSectionRef = React.useRef<SectionRef>(null)
  const labelsSectionRef = React.useRef<SectionRef>(null)

  useSetTitle(combinedDisplayName(profile))

  const description = profile.description ?? ''
  const hasDescription = description !== ''
  const [descriptionRT, isResolvingDescriptionRT] = useRichText(description)
  const showPlaceholder = isPlaceholderProfile || isResolvingDescriptionRT
  const moderation = useMemo(
    () => moderateProfile(profile, moderationOpts),
    [profile, moderationOpts],
  )

  const isMe = profile.did === currentAccount?.did
  const hasLabeler = !!profile.associated?.labeler
  const showFiltersTab = hasLabeler
  const showPostsTab = true
  const showRepliesTab = hasSession
  const showMediaTab = !hasLabeler
  const showLikesTab = isMe
  const showFeedsTab =
    hasSession && (isMe || (profile.associated?.feedgens || 0) > 0)
  const showListsTab =
    hasSession && (isMe || (profile.associated?.lists || 0) > 0)

  const sectionTitles = useMemo<string[]>(() => {
    return [
      showFiltersTab ? _(msg`Labels`) : undefined,
      showListsTab && hasLabeler ? _(msg`Lists`) : undefined,
      showPostsTab ? _(msg`Posts`) : undefined,
      showRepliesTab ? _(msg`Replies`) : undefined,
      showMediaTab ? _(msg`Media`) : undefined,
      showLikesTab ? _(msg`Likes`) : undefined,
      showFeedsTab ? _(msg`Feeds`) : undefined,
      showListsTab && !hasLabeler ? _(msg`Lists`) : undefined,
    ].filter(Boolean) as string[]
  }, [
    showPostsTab,
    showRepliesTab,
    showMediaTab,
    showLikesTab,
    showFeedsTab,
    showListsTab,
    showFiltersTab,
    hasLabeler,
    _,
  ])

  let nextIndex = 0
  let filtersIndex: number | null = null
  let postsIndex: number | null = null
  let repliesIndex: number | null = null
  let mediaIndex: number | null = null
  let likesIndex: number | null = null
  let feedsIndex: number | null = null
  let listsIndex: number | null = null
  if (showFiltersTab) {
    filtersIndex = nextIndex++
  }
  if (showPostsTab) {
    postsIndex = nextIndex++
  }
  if (showRepliesTab) {
    repliesIndex = nextIndex++
  }
  if (showMediaTab) {
    mediaIndex = nextIndex++
  }
  if (showLikesTab) {
    likesIndex = nextIndex++
  }
  if (showFeedsTab) {
    feedsIndex = nextIndex++
  }
  if (showListsTab) {
    listsIndex = nextIndex++
  }

  const scrollSectionToTop = React.useCallback(
    (index: number) => {
      if (index === filtersIndex) {
        labelsSectionRef.current?.scrollToTop()
      } else if (index === postsIndex) {
        postsSectionRef.current?.scrollToTop()
      } else if (index === repliesIndex) {
        repliesSectionRef.current?.scrollToTop()
      } else if (index === mediaIndex) {
        mediaSectionRef.current?.scrollToTop()
      } else if (index === likesIndex) {
        likesSectionRef.current?.scrollToTop()
      } else if (index === feedsIndex) {
        feedsSectionRef.current?.scrollToTop()
      } else if (index === listsIndex) {
        listsSectionRef.current?.scrollToTop()
      }
    },
    [
      filtersIndex,
      postsIndex,
      repliesIndex,
      mediaIndex,
      likesIndex,
      feedsIndex,
      listsIndex,
    ],
  )

  useFocusEffect(
    React.useCallback(() => {
      setMinimalShellMode(false)
      screen('Profile')
      return listenSoftReset(() => {
        scrollSectionToTop(currentPage)
      })
    }, [setMinimalShellMode, screen, currentPage, scrollSectionToTop]),
  )

  useFocusEffect(
    React.useCallback(() => {
      setDrawerSwipeDisabled(currentPage > 0)
      return () => {
        setDrawerSwipeDisabled(false)
      }
    }, [setDrawerSwipeDisabled, currentPage]),
  )

  // events
  // =

  const onPressCompose = React.useCallback(() => {
    track('ProfileScreen:PressCompose')
    const mention =
      profile.handle === currentAccount?.handle ||
      isInvalidHandle(profile.handle)
        ? undefined
        : profile.handle
    openComposer({mention})
  }, [openComposer, currentAccount, track, profile])

  const onPageSelected = React.useCallback((i: number) => {
    setCurrentPage(i)
  }, [])

  const onCurrentPageSelected = React.useCallback(
    (index: number) => {
      scrollSectionToTop(index)
    },
    [scrollSectionToTop],
  )

  // rendering
  // =

  const renderHeader = React.useCallback(() => {
    if (shouldUseScrollableHeader) {
      return (
        <ExpoScrollForwarderView scrollViewTag={scrollViewTag}>
          <ProfileHeader
            profile={profile}
            labeler={labelerInfo}
            descriptionRT={hasDescription ? descriptionRT : null}
            moderationOpts={moderationOpts}
            hideBackButton={hideBackButton}
            isPlaceholderProfile={showPlaceholder}
          />
        </ExpoScrollForwarderView>
      )
    } else {
      return (
        <ProfileHeader
          profile={profile}
          labeler={labelerInfo}
          descriptionRT={hasDescription ? descriptionRT : null}
          moderationOpts={moderationOpts}
          hideBackButton={hideBackButton}
          isPlaceholderProfile={showPlaceholder}
        />
      )
    }
  }, [
    shouldUseScrollableHeader,
    scrollViewTag,
    profile,
    labelerInfo,
    hasDescription,
    descriptionRT,
    moderationOpts,
    hideBackButton,
    showPlaceholder,
  ])

  return (
    <ScreenHider
      testID="profileView"
      style={styles.container}
      screenDescription={_(msg`profile`)}
      modui={moderation.ui('profileView')}>
      <PagerWithHeader
        testID="profilePager"
        isHeaderReady={!showPlaceholder}
        items={sectionTitles}
        onPageSelected={onPageSelected}
        onCurrentPageSelected={onCurrentPageSelected}
        renderHeader={renderHeader}>
        {showFiltersTab
          ? ({headerHeight, isFocused, scrollElRef}) => (
              <ProfileLabelsSection
                ref={labelsSectionRef}
                labelerInfo={labelerInfo}
                labelerError={labelerError}
                isLabelerLoading={isLabelerLoading}
                moderationOpts={moderationOpts}
                scrollElRef={scrollElRef as ListRef}
                headerHeight={headerHeight}
                isFocused={isFocused}
                setScrollViewTag={setScrollViewTag}
              />
            )
          : null}
        {showListsTab && !!profile.associated?.labeler
          ? ({headerHeight, isFocused, scrollElRef}) => (
              <ProfileLists
                ref={listsSectionRef}
                did={profile.did}
                scrollElRef={scrollElRef as ListRef}
                headerOffset={headerHeight}
                enabled={isFocused}
                setScrollViewTag={setScrollViewTag}
              />
            )
          : null}
        {showPostsTab
          ? ({headerHeight, isFocused, scrollElRef}) => (
              <ProfileFeedSection
                ref={postsSectionRef}
                feed={`author|${profile.did}|posts_and_author_threads`}
                headerHeight={headerHeight}
                isFocused={isFocused}
                scrollElRef={scrollElRef as ListRef}
                ignoreFilterFor={profile.did}
                setScrollViewTag={setScrollViewTag}
              />
            )
          : null}
        {showRepliesTab
          ? ({headerHeight, isFocused, scrollElRef}) => (
              <ProfileFeedSection
                ref={repliesSectionRef}
                feed={`author|${profile.did}|posts_with_replies`}
                headerHeight={headerHeight}
                isFocused={isFocused}
                scrollElRef={scrollElRef as ListRef}
                ignoreFilterFor={profile.did}
                setScrollViewTag={setScrollViewTag}
              />
            )
          : null}
        {showMediaTab
          ? ({headerHeight, isFocused, scrollElRef}) => (
              <ProfileFeedSection
                ref={mediaSectionRef}
                feed={`author|${profile.did}|posts_with_media`}
                headerHeight={headerHeight}
                isFocused={isFocused}
                scrollElRef={scrollElRef as ListRef}
                ignoreFilterFor={profile.did}
                setScrollViewTag={setScrollViewTag}
              />
            )
          : null}
        {showLikesTab
          ? ({headerHeight, isFocused, scrollElRef}) => (
              <ProfileFeedSection
                ref={likesSectionRef}
                feed={`likes|${profile.did}`}
                headerHeight={headerHeight}
                isFocused={isFocused}
                scrollElRef={scrollElRef as ListRef}
                ignoreFilterFor={profile.did}
                setScrollViewTag={setScrollViewTag}
              />
            )
          : null}
        {showFeedsTab
          ? ({headerHeight, isFocused, scrollElRef}) => (
              <ProfileFeedgens
                ref={feedsSectionRef}
                did={profile.did}
                scrollElRef={scrollElRef as ListRef}
                headerOffset={headerHeight}
                enabled={isFocused}
                setScrollViewTag={setScrollViewTag}
              />
            )
          : null}
        {showListsTab && !profile.associated?.labeler
          ? ({headerHeight, isFocused, scrollElRef}) => (
              <ProfileLists
                ref={listsSectionRef}
                did={profile.did}
                scrollElRef={scrollElRef as ListRef}
                headerOffset={headerHeight}
                enabled={isFocused}
                setScrollViewTag={setScrollViewTag}
              />
            )
          : null}
      </PagerWithHeader>
      {hasSession && (
        <FAB
          testID="composeFAB"
          onPress={onPressCompose}
          icon={<ComposeIcon2 strokeWidth={1.5} size={29} style={s.white} />}
          accessibilityRole="button"
          accessibilityLabel={_(msg`New post`)}
          accessibilityHint=""
        />
      )}
    </ScreenHider>
  )
}

function useRichText(text: string): [RichTextAPI, boolean] {
  const [prevText, setPrevText] = React.useState(text)
  const [rawRT, setRawRT] = React.useState(() => new RichTextAPI({text}))
  const [resolvedRT, setResolvedRT] = React.useState<RichTextAPI | null>(null)
  if (text !== prevText) {
    setPrevText(text)
    setRawRT(new RichTextAPI({text}))
    setResolvedRT(null)
    // This will queue an immediate re-render
  }
  React.useEffect(() => {
    let ignore = false
    async function resolveRTFacets() {
      // new each time
      const resolvedRT = new RichTextAPI({text})
      await resolvedRT.detectFacets(getAgent())
      if (!ignore) {
        setResolvedRT(resolvedRT)
      }
    }
    resolveRTFacets()
    return () => {
      ignore = true
    }
  }, [text])
  const isResolving = resolvedRT === null
  return [resolvedRT ?? rawRT, isResolving]
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    height: '100%',
    // @ts-ignore Web-only.
    overflowAnchor: 'none', // Fixes jumps when switching tabs while scrolled down.
  },
  loading: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  emptyState: {
    paddingVertical: 40,
  },
  loadingMoreFooter: {
    paddingVertical: 20,
  },
  endItem: {
    paddingTop: 20,
    paddingBottom: 30,
    color: colors.gray5,
    textAlign: 'center',
  },
})
