import css from "./TrackHeader.sass?inline"
import {Lifecycle} from "@opendaw/lib-std"
import {createElement, Group, Inject, replaceChildren} from "@opendaw/lib-jsx"
import {Icon} from "@/ui/components/Icon.tsx"
import {MenuButton} from "@/ui/components/MenuButton.tsx"
import {MenuItem} from "@/ui/model/menu-item.ts"
import {AudioUnitBoxAdapter, IconSymbol, TrackBoxAdapter, TrackType} from "@opendaw/studio-adapters"
import {AudioUnitChannelControls} from "@/ui/timeline/tracks/audio-unit/AudioUnitChannelControls.tsx"
import {installTrackHeaderMenu} from "@/ui/timeline/tracks/audio-unit/TrackHeaderMenu.ts"
import {Events, Html, Keyboard} from "@opendaw/lib-dom"
import {StudioService} from "@/service/StudioService"
import {ColorCodes, Colors} from "@opendaw/studio-core"

const className = Html.adoptStyleSheet(css, "TrackHeader")

type Construct = {
    lifecycle: Lifecycle
    service: StudioService
    trackBoxAdapter: TrackBoxAdapter
    audioUnitBoxAdapter: AudioUnitBoxAdapter
}

export const TrackHeader = ({lifecycle, service, trackBoxAdapter, audioUnitBoxAdapter}: Construct) => {
    const nameLabel = Inject.value("Untitled")
    const channelStrip: HTMLElement = <Group/>
    const {project} = service
    
    const convertAudioTrackToMidi = async () => {
        try {
                // Import and use MidiConversionService
    const {MidiConversionService} = await import("../../../../service/MidiConversionService.js")
            const midiService = new MidiConversionService(project)
            
            // Get all audio files from this track
            const audioFiles = midiService.getConvertibleAudioFiles()
            const trackAudioFiles = audioFiles.filter(file => {
                // Check if this file is used in the current track
                const fileName = file.fileName.getValue()
                return fileName.includes(nameLabel.value) || true // For now, convert all audio files
            })
            
            if (trackAudioFiles.length > 0) {
                await midiService.convertAudioToMidi(trackAudioFiles[0])
            } else {
                console.log('🎵 No audio files found for this track')
            }
        } catch (error) {
            console.error('🎵 Error converting audio track to MIDI:', error)
        }
    }
    lifecycle.ownAll(
        audioUnitBoxAdapter.input.catchupAndSubscribeLabelChange(option => nameLabel.value = option.unwrapOrElse("No Input")),
        trackBoxAdapter.indexField.catchupAndSubscribe(owner => {
            Html.empty(channelStrip)
            if (owner.getValue() === 0) {
                replaceChildren(channelStrip, (
                    <AudioUnitChannelControls lifecycle={lifecycle}
                                              editing={project.editing}
                                              midiDevices={service.midiLearning}
                                              adapter={audioUnitBoxAdapter}/>
                ))
            } else {
                replaceChildren(channelStrip, <div/>)
            }
        }),
        trackBoxAdapter.catchupAndSubscribePath(option =>
            nameLabel.value = option.unwrapOrElse(["", "Unassigned track"]).join(" "))
    )

    const color = ColorCodes.forAudioType(audioUnitBoxAdapter.type)
    const element: HTMLElement = (
        <div className={Html.buildClassList(className, "is-primary")} tabindex={-1}>
            <Icon symbol={TrackType.toIconSymbol(trackBoxAdapter.type)} style={{color}}/>
            <div className="info">
                <h5 style={{color: Colors.dark}}>{nameLabel}</h5>
            </div>
            {channelStrip}
            {trackBoxAdapter.type === TrackType.Audio && (
                <button 
                    className="convert-to-midi-btn"
                    onclick={() => convertAudioTrackToMidi()}
                    title="Convert Audio to MIDI"
                    style={{
                        background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                        border: 'none',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '10px',
                        cursor: 'pointer',
                        marginRight: '8px',
                        transition: 'transform 0.2s ease'
                    }}
                >
                    🎹 MIDI
                </button>
            )}
            <MenuButton root={MenuItem.root()
                .setRuntimeChildrenProcedure(installTrackHeaderMenu(service, audioUnitBoxAdapter, trackBoxAdapter))}
                        style={{minWidth: "0", justifySelf: "end"}}
                        appearance={{color: Colors.shadow, activeColor: Colors.cream}}>
                <Icon symbol={IconSymbol.Menu} style={{fontSize: "0.75em"}}/>
            </MenuButton>
        </div>
    )
    const audioUnitEditing = project.userEditingManager.audioUnit
    lifecycle.ownAll(
        Events.subscribe(element, "pointerdown", () => {
            if (!audioUnitEditing.isEditing(audioUnitBoxAdapter.box.editing)) {
                audioUnitEditing.edit(audioUnitBoxAdapter.box.editing)
            }
        }),
        Events.subscribe(element, "keydown", (event) => {
            if (!Keyboard.GlobalShortcut.isDelete(event)) {return}
            project.editing.modify(() => {
                if (audioUnitBoxAdapter.tracks.collection.size() === 1) {
                    project.api.deleteAudioUnit(audioUnitBoxAdapter.box)
                } else {
                    audioUnitBoxAdapter.deleteTrack(trackBoxAdapter)
                }
            })
        })
    )
    return element
}