import * as vscode from "vscode";

import { Cluster, Client } from "../../client";
import { NodeBase } from "./nodeBase";
import { BrokerGroupItem } from "./brokers";
import { TopicGroupItem, TopicItem } from "./topics";

import { ConsumerGroupsItem } from "./consumerGroups";
import { KafkaModel } from "./kafka";
import { Disposable } from "vscode";
import { GlyphChars } from "../../constants";

const TOPIC_INDEX = 1;

export class ClusterItem extends NodeBase implements Disposable {
    public contextValue = "cluster";
    public collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;

    constructor(public client: Client, public readonly cluster: Cluster, parent: KafkaModel) {
        super(parent);
        this.label = cluster.name;
        this.description = cluster.bootstrap;
    }

    async computeChildren(): Promise<NodeBase[]> {
        return [
            new BrokerGroupItem(this),
            new TopicGroupItem(this),
            new ConsumerGroupsItem(this)];
    }

    getParent(): KafkaModel {
        return <KafkaModel>super.getParent();
    }

    getTreeItem(): vscode.TreeItem {
        const treeItem = super.getTreeItem();
        // to prevent from tree expansion after a refresh, we need to force the id to a static value
        // because we change the label according if cluster is selected or not.
        treeItem.id = this.cluster.name;
        // update label and contextValue (used by contextual menu) according the selection state
        if (this.selected) {
            treeItem.contextValue = 'selectedCluster';
            treeItem.label = GlyphChars.Check + ' ' + treeItem.label;
        } else {
            treeItem.contextValue = 'cluster';
        }
        return treeItem;
    }

    public get selected(): boolean {
        return (this.getParent().clusterSettings.selected?.name === this.cluster.name);
    }

    public dispose(): void {
        this.client.dispose();
    }

    async findTopictemByName(topicName: string): Promise<NodeBase | TopicItem | undefined> {
        const topics = (await this.getTopicGroupItem()).getChildren();
        return topics
            .then(t =>
                t.find(child => (<TopicItem>child).topic.id === topicName));
    }

    private async getTopicGroupItem(): Promise<NodeBase> {
        return (await this.getChildren())[TOPIC_INDEX];
    }

}
